import { useQuery } from '@tanstack/react-query'
import type { Budget2026Line } from '@/features/annual-analysis/api/getAnnual2026BudgetLines'
import { getAnnual2026BudgetLines } from '@/features/annual-analysis/api/getAnnual2026BudgetLines'
import { getAnnual2026Actuals } from '@/features/annual-analysis/api/getAnnual2026Actuals'
import { getSavingsBudgetTotalsByPeriod } from '@/features/stats/api/getSavingsBudgetTotalsByPeriod'
import {
  BUCKET_ORDER,
  BUCKET_LABELS,
  BUCKET_COLORS,
  VIZ_PALETTE,
  MONTH_LABELS_SHORT,
} from '@/features/annual-analysis/components/_constants'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Budget2026BucketSummary {
  key: string
  label: string
  color: string
  monthlyBudget: number
  ytdBudget: number          // × 5 mois (Jan–Mai)
  pctOfTotal: number
  lineCount: number
}

export interface Budget2026CategorySummary {
  name: string
  monthlyBudget: number
  annualBudget: number
  pctOfTotal: number
  color: string
  bucket: string
  lines: Budget2026Line[]
  ytdActual: number
  ytdMonthCount: number
  ytdAvgMonthly: number
  realisticAnnual: number
}

export interface Budget2026InsightCard {
  key: string
  level: 'info' | 'success' | 'warning' | 'alert'
  title: string
  main: string
  sub: string | null
  detail: string | null
}

export interface Budget2026OptimizationScenario {
  bucket: string
  bucketLabel: string
  color: string
  monthlyBudget: number
  reductionPct: number
  monthlySaving: number
  annualSaving: number
  categories: string[]
}

export interface MonthlyBudget2026Point {
  month: number
  monthLabel: string
  totalExpenseBudget: number
  totalNeed: number          // dépenses + épargne
  buckets: Record<string, number>
}

export interface Annual2026Summary {
  totalMonthlyBudget: number   // budget dépenses / mois
  totalSavingsBudget: number   // épargne / mois
  totalMonthlyNeed: number     // totalMonthlyBudget + totalSavingsBudget
  ytdMonths: number            // mois écoulés depuis Jan de l'année en cours
  ytdBudgetTotal: number       // totalMonthlyBudget × ytdMonths
  ytdSavingsTotal: number      // totalSavingsBudget × ytdMonths
  ytdTotalNeed: number         // ytdBudgetTotal + ytdSavingsTotal
  coverageScore: number        // score fictif de taux de couverture (0–100)
}

export interface Annual2026Analysis {
  loading: boolean
  error: string | null
  summary: Annual2026Summary | null
  buckets: Budget2026BucketSummary[]
  categories: Budget2026CategorySummary[]
  insights: Budget2026InsightCard[]
  optimizations: Budget2026OptimizationScenario[]
  monthlyProfile: MonthlyBudget2026Point[]
  rawLines: Budget2026Line[]
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function extractSavingsMonthly(rows: Array<Record<string, unknown>>): number | null {
  const candidates = ['total_savings_budget_eur', 'target_savings_total_eur', 'target_total_eur', 'budget_total_eur']
  for (const row of rows) {
    for (const field of candidates) {
      const v = row[field]
      const n = typeof v === 'number' ? v : typeof v === 'string' ? parseFloat(v) : NaN
      if (!isNaN(n) && n > 0) return n
    }
  }
  return null
}



function pct(part: number, total: number): number {
  if (total === 0) return 0
  return part / total
}

// ─── Derivations ──────────────────────────────────────────────────────────────

function buildBuckets(lines: Budget2026Line[], totalBudget: number, ytdMonths: number): Budget2026BucketSummary[] {
  const map = new Map<string, { amount: number; count: number }>()

  for (const line of lines) {
    const existing = map.get(line.effective_bucket) ?? { amount: 0, count: 0 }
    map.set(line.effective_bucket, {
      amount: existing.amount + line.amount,
      count: existing.count + 1,
    })
  }

  return BUCKET_ORDER
    .filter((key) => map.has(key))
    .map((key) => {
      const entry = map.get(key)!
      return {
        key,
        label: BUCKET_LABELS[key] ?? key,
        color: BUCKET_COLORS[key] ?? '#B0BEC5',
        monthlyBudget: entry.amount,
        ytdBudget: entry.amount * ytdMonths,
        pctOfTotal: pct(entry.amount, totalBudget),
        lineCount: entry.count,
      }
    })
}

function buildCategories(
  lines: Budget2026Line[],
  totalBudget: number,
  actualsMap: Map<string, { ytdActual: number; monthCount: number }>,
  remainingMonths: number,
): Budget2026CategorySummary[] {
  const map = new Map<string, { amount: number; bucket: string; lines: Budget2026Line[] }>()

  for (const line of lines) {
    const key = line.parent_category_name
    const existing = map.get(key) ?? { amount: 0, bucket: line.effective_bucket, lines: [] }
    map.set(key, {
      amount: existing.amount + line.amount,
      bucket: existing.bucket,
      lines: [...existing.lines, line],
    })
  }

  return [...map.entries()]
    .sort((a, b) => b[1].amount - a[1].amount)
    .map(([name, entry], i) => {
      const actuals = actualsMap.get(name) ?? { ytdActual: 0, monthCount: 0 }
      const ytdAvgMonthly = actuals.monthCount > 0 ? actuals.ytdActual / actuals.monthCount : 0
      const realisticAnnual = actuals.ytdActual + ytdAvgMonthly * remainingMonths
      return {
        name,
        monthlyBudget: entry.amount,
        annualBudget: entry.amount * 12,
        pctOfTotal: pct(entry.amount, totalBudget),
        color: VIZ_PALETTE[i % VIZ_PALETTE.length] ?? '#B0BEC5',
        bucket: entry.bucket,
        lines: entry.lines,
        ytdActual: actuals.ytdActual,
        ytdMonthCount: actuals.monthCount,
        ytdAvgMonthly,
        realisticAnnual,
      }
    })
}

function buildInsights(
  lines: Budget2026Line[],
  buckets: Budget2026BucketSummary[],
  categories: Budget2026CategorySummary[],
  summary: Annual2026Summary,
): Budget2026InsightCard[] {
  const cards: Budget2026InsightCard[] = []

  // 1 – Poste dominant
  const topCat = categories[0]
  if (topCat) {
    cards.push({
      key: 'top_category',
      level: 'info',
      title: 'Famille dominante',
      main: topCat.name,
      sub: `${new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(topCat.monthlyBudget)} / mois`,
      detail: `${(topCat.pctOfTotal * 100).toFixed(1)}% du budget dépenses`,
    })
  }

  // 2 – Ratio socle fixe vs discrétionnaire
  const socle = buckets.find((b) => b.key === 'socle_fixe')
  const disc = buckets.find((b) => b.key === 'discretionnaire')
  if (socle && disc) {
    const ratio = socle.monthlyBudget / (disc.monthlyBudget || 1)
    cards.push({
      key: 'fixe_vs_disc',
      level: ratio > 1.5 ? 'warning' : 'success',
      title: 'Fixe vs Discrétionnaire',
      main: `${ratio.toFixed(1)}×`,
      sub: `${new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(socle.monthlyBudget)} vs ${new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(disc.monthlyBudget)}`,
      detail: ratio > 1.5 ? 'Rigidité élevée — contrainte structurelle' : 'Bon équilibre rigidité / flexibilité',
    })
  }

  // 3 – Taux d'épargne
  const savingsRate = pct(summary.totalSavingsBudget, summary.totalMonthlyNeed)
  cards.push({
    key: 'savings_rate',
    level: savingsRate >= 0.12 ? 'success' : savingsRate >= 0.08 ? 'warning' : 'alert',
    title: 'Taux d\'épargne cible',
    main: `${(savingsRate * 100).toFixed(1)}%`,
    sub: `${new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(summary.totalSavingsBudget)} / mois`,
    detail: savingsRate >= 0.12 ? 'Objectif solide ✓' : 'Marge de progression possible',
  })

  // 4 – Part provisions / imprévus
  const provision = buckets.find((b) => b.key === 'provision')
  if (provision) {
    cards.push({
      key: 'provision_cover',
      level: provision.pctOfTotal >= 0.15 ? 'success' : 'warning',
      title: 'Couverture provisions',
      main: `${(provision.pctOfTotal * 100).toFixed(1)}%`,
      sub: `${new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(provision.monthlyBudget)} / mois`,
      detail: 'Cadeaux, frais exceptionnels, santé…',
    })
  }

  // 5 – Budget investissement pro
  const proLines = lines.filter((l) => l.parent_category_name === 'Business')
  const proBudget = proLines.reduce((s, l) => s + l.amount, 0)
  if (proBudget > 0) {
    const proPct = pct(proBudget, summary.totalMonthlyBudget)
    cards.push({
      key: 'pro_investment',
      level: 'info',
      title: 'Investissement freelance',
      main: `${new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(proBudget)} / mois`,
      sub: `${(proPct * 100).toFixed(1)}% du budget — ${proLines.length} poste${proLines.length > 1 ? 's' : ''}`,
      detail: 'Formations, outils, abonnements pro',
    })
  }

  return cards
}

function buildOptimizations(
  buckets: Budget2026BucketSummary[],
  categories: Budget2026CategorySummary[],
): Budget2026OptimizationScenario[] {
  // On propose des scénarios sur les buckets discrétionnaires + provision
  const targets = ['discretionnaire', 'provision', 'variable_essentielle', 'cagnotte_projet']
  const reductions = [10, 8, 6, 12]

  return targets
    .map((key, idx) => {
      const bucket = buckets.find((b) => b.key === key)
      if (!bucket) return null
      const reduction = reductions[idx] ?? 8
      const monthlySaving = (bucket.monthlyBudget * reduction) / 100
      const catsForBucket = categories
        .filter((c) => c.bucket === key || c.lines.some((l) => l.effective_bucket === key))
        .slice(0, 3)
        .map((c) => c.name)

      return {
        bucket: key,
        bucketLabel: bucket.label,
        color: bucket.color,
        monthlyBudget: bucket.monthlyBudget,
        reductionPct: reduction,
        monthlySaving,
        annualSaving: monthlySaving * 12,
        categories: catsForBucket,
      }
    })
    .filter((s): s is Budget2026OptimizationScenario => s !== null)
}

function buildMonthlyProfile(buckets: Budget2026BucketSummary[], ytdMonths: number, savingsMonthly: number): MonthlyBudget2026Point[] {
  return Array.from({ length: ytdMonths }, (_, i) => {
    const month = i + 1
    const bucketValues: Record<string, number> = {}
    let total = 0

    for (const b of buckets) {
      const val = Math.round(b.monthlyBudget)
      bucketValues[b.key] = val
      total += val
    }

    return {
      month,
      monthLabel: MONTH_LABELS_SHORT[month - 1] ?? `M${month}`,
      totalExpenseBudget: total,
      totalNeed: total + savingsMonthly,
      buckets: bucketValues,
    }
  })
}

// ─── Fetch function ───────────────────────────────────────────────────────────

type Annual2026QueryData = Omit<Annual2026Analysis, 'loading'> & { error: string | null }

async function fetchAnnual2026Analysis(): Promise<Annual2026QueryData> {
  const year = new Date().getFullYear()
  const currentMonth = new Date().getMonth() + 1
  const ytdMonths = Math.min(currentMonth, 12)
  const remainingMonths = 12 - currentMonth

  let effectiveLines: Budget2026Line[]
  let queryError: string | null = null
  let actualsMap = new Map<string, { ytdActual: number; monthCount: number }>()
  let savingsMonthly = 500

  try {
    const [lines, actuals, savingsTotals] = await Promise.all([
      getAnnual2026BudgetLines(),
      getAnnual2026Actuals(year),
      getSavingsBudgetTotalsByPeriod(year, currentMonth),
    ])
    effectiveLines = lines.length > 0 ? lines : STATIC_BUDGET_LINES
    for (const a of actuals) {
      actualsMap.set(a.parentCategoryName, { ytdActual: a.ytdActual, monthCount: a.monthCount })
    }
    savingsMonthly = extractSavingsMonthly(savingsTotals as Array<Record<string, unknown>>) ?? 500
  } catch (err) {
    effectiveLines = STATIC_BUDGET_LINES
    queryError = err instanceof Error ? `${err.message} (données statiques affichées)` : null
  }

  const totalMonthlyBudget = effectiveLines.reduce((s, l) => s + l.amount, 0)
  const totalMonthlyNeed = totalMonthlyBudget + savingsMonthly

  const summary: Annual2026Summary = {
    totalMonthlyBudget,
    totalSavingsBudget: savingsMonthly,
    totalMonthlyNeed,
    ytdMonths,
    ytdBudgetTotal: totalMonthlyBudget * ytdMonths,
    ytdSavingsTotal: savingsMonthly * ytdMonths,
    ytdTotalNeed: totalMonthlyNeed * ytdMonths,
    coverageScore: Math.round(Math.min(100, (savingsMonthly / totalMonthlyNeed) * 100 * 7)),
  }

  const buckets = buildBuckets(effectiveLines, totalMonthlyBudget, ytdMonths)
  const categories = buildCategories(effectiveLines, totalMonthlyBudget, actualsMap, remainingMonths)

  return {
    error: queryError,
    summary,
    buckets,
    categories,
    insights: buildInsights(effectiveLines, buckets, categories, summary),
    optimizations: buildOptimizations(buckets, categories),
    monthlyProfile: buildMonthlyProfile(buckets, ytdMonths, savingsMonthly),
    rawLines: effectiveLines,
  }
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useAnnual2026Analysis(): Annual2026Analysis {
  const query = useQuery({
    queryKey: ['annual-2026-analysis'],
    queryFn: fetchAnnual2026Analysis,
    staleTime: 15 * 60_000,
  })

  return {
    loading: query.isPending,
    error: query.data?.error ?? null,
    summary: query.data?.summary ?? null,
    buckets: query.data?.buckets ?? [],
    categories: query.data?.categories ?? [],
    insights: query.data?.insights ?? [],
    optimizations: query.data?.optimizations ?? [],
    monthlyProfile: query.data?.monthlyProfile ?? [],
    rawLines: query.data?.rawLines ?? [],
  }
}

// ─── Données statiques fallback (source: JSON export) ─────────────────────────

const STATIC_BUDGET_LINES: Budget2026Line[] = [
  { category_name: 'Autres abonnements', parent_category_name: 'Abonnements', amount: 10.5, effective_bucket: 'socle_fixe', method: 'fixed_real' },
  { category_name: 'IT', parent_category_name: 'Abonnements', amount: 16.48, effective_bucket: 'socle_fixe', method: 'fixed_real' },
  { category_name: 'LLM', parent_category_name: 'Abonnements', amount: 52.3, effective_bucket: 'socle_fixe', method: 'fixed_real' },
  { category_name: 'Téléphonie mobile', parent_category_name: 'Abonnements', amount: 15.99, effective_bucket: 'socle_fixe', method: 'fixed_real' },
  { category_name: 'Amazon / e-commerce', parent_category_name: 'Achats divers', amount: 30.0, effective_bucket: 'discretionnaire', method: 'discretionary_minus_15' },
  { category_name: 'Cadeaux', parent_category_name: 'Achats divers', amount: 155.0, effective_bucket: 'provision', method: 'provision_monthly' },
  { category_name: 'Coiffeur', parent_category_name: 'Achats divers', amount: 20.0, effective_bucket: 'discretionnaire', method: 'discretionary_minus_10' },
  { category_name: 'Divers', parent_category_name: 'Achats divers', amount: 130.0, effective_bucket: 'discretionnaire', method: 'discretionary_minus_15' },
  { category_name: 'Frais exceptionnels', parent_category_name: 'Achats divers', amount: 320.0, effective_bucket: 'provision', method: 'provision_monthly' },
  { category_name: 'Maison', parent_category_name: 'Achats divers', amount: 10.0, effective_bucket: 'provision', method: 'provision_monthly' },
  { category_name: 'Vêtements', parent_category_name: 'Achats divers', amount: 85.0, effective_bucket: 'discretionnaire', method: 'discretionary_minus_10' },
  { category_name: 'Alimentation rapide', parent_category_name: 'Alimentation', amount: 60.0, effective_bucket: 'discretionnaire', method: 'discretionary_minus_10' },
  { category_name: 'Courses', parent_category_name: 'Alimentation', amount: 250.0, effective_bucket: 'variable_essentielle', method: 'essential_buffer_08' },
  { category_name: 'Petits achats alimentaires', parent_category_name: 'Alimentation', amount: 205.0, effective_bucket: 'discretionnaire', method: 'essential_buffer_05' },
  { category_name: 'Abonnements professionnels', parent_category_name: 'Business', amount: 10.0, effective_bucket: 'cagnotte_projet', method: 'project_cagnotte' },
  { category_name: 'Achats professionnels', parent_category_name: 'Business', amount: 60.0, effective_bucket: 'cagnotte_projet', method: 'project_cagnotte' },
  { category_name: 'Formations', parent_category_name: 'Business', amount: 80.0, effective_bucket: 'cagnotte_projet', method: 'project_cagnotte' },
  { category_name: 'Achats bébé', parent_category_name: 'Famille / enfant', amount: 145.0, effective_bucket: 'variable_essentielle', method: 'essential_buffer_08' },
  { category_name: 'Divers enfant', parent_category_name: 'Famille / enfant', amount: 10.0, effective_bucket: 'variable_essentielle', method: 'essential_buffer_10' },
  { category_name: 'Frais bancaires', parent_category_name: 'Frais bancaires / impôts', amount: 15.64, effective_bucket: 'socle_fixe', method: 'fixed_real' },
  { category_name: 'Taxes / frais administratifs', parent_category_name: 'Frais bancaires / impôts', amount: 10.0, effective_bucket: 'provision', method: 'provision_monthly' },
  { category_name: 'Assurance habitation', parent_category_name: 'Logement', amount: 33.65, effective_bucket: 'socle_fixe', method: 'fixed_real' },
  { category_name: 'Charges logement', parent_category_name: 'Logement', amount: 149.25, effective_bucket: 'socle_fixe', method: 'fixed_real' },
  { category_name: 'Électricité', parent_category_name: 'Logement', amount: 32.35, effective_bucket: 'socle_fixe', method: 'fixed_real' },
  { category_name: 'Internet / télécom logement', parent_category_name: 'Logement', amount: 20.0, effective_bucket: 'socle_fixe', method: 'fixed_real' },
  { category_name: 'Loyer / crédit', parent_category_name: 'Logement', amount: 330.0, effective_bucket: 'socle_fixe', method: 'fixed_real' },
  { category_name: 'Stockage', parent_category_name: 'Logement', amount: 146.0, effective_bucket: 'socle_fixe', method: 'fixed_real' },
  { category_name: 'Culture', parent_category_name: 'Loisirs', amount: 50.0, effective_bucket: 'discretionnaire', method: 'discretionary_minus_10' },
  { category_name: 'Loisirs', parent_category_name: 'Loisirs', amount: 30.0, effective_bucket: 'discretionnaire', method: 'discretionary_minus_10' },
  { category_name: 'Médecin / soins', parent_category_name: 'Santé', amount: 25.0, effective_bucket: 'provision', method: 'provision_monthly' },
  { category_name: 'Optique', parent_category_name: 'Santé', amount: 10.0, effective_bucket: 'provision', method: 'provision_monthly' },
  { category_name: 'Pharmacie', parent_category_name: 'Santé', amount: 30.0, effective_bucket: 'variable_essentielle', method: 'essential_buffer_10' },
  { category_name: 'Vétérinaire', parent_category_name: 'Santé', amount: 10.0, effective_bucket: 'provision', method: 'provision_monthly' },
  { category_name: 'Autres', parent_category_name: 'Sorties', amount: 45.0, effective_bucket: 'discretionnaire', method: 'discretionary_minus_15' },
  { category_name: 'Cafés / bars', parent_category_name: 'Sorties', amount: 30.0, effective_bucket: 'discretionnaire', method: 'discretionary_minus_10' },
  { category_name: 'Restaurants', parent_category_name: 'Sorties', amount: 70.0, effective_bucket: 'discretionnaire', method: 'discretionary_minus_10' },
  { category_name: 'Assurance auto', parent_category_name: 'Transport', amount: 62.0, effective_bucket: 'socle_fixe', method: 'fixed_real' },
  { category_name: 'Carburant', parent_category_name: 'Transport', amount: 65.0, effective_bucket: 'variable_essentielle', method: 'essential_buffer_08' },
  { category_name: 'Entretien véhicule', parent_category_name: 'Transport', amount: 15.0, effective_bucket: 'provision', method: 'provision_monthly' },
  { category_name: 'Parking', parent_category_name: 'Transport', amount: 5.0, effective_bucket: 'variable_essentielle', method: 'essential_buffer_05' },
  { category_name: 'Péages', parent_category_name: 'Transport', amount: 10.0, effective_bucket: 'variable_essentielle', method: 'essential_buffer_05' },
  { category_name: 'Transport public', parent_category_name: 'Transport', amount: 15.0, effective_bucket: 'variable_essentielle', method: 'essential_buffer_05' },
  { category_name: 'Activités', parent_category_name: 'Voyages', amount: 10.0, effective_bucket: 'cagnotte_projet', method: 'project_cagnotte' },
  { category_name: 'Froustilles', parent_category_name: 'Voyages', amount: 20.0, effective_bucket: 'cagnotte_projet', method: 'project_cagnotte' },
  { category_name: 'Logement voyage', parent_category_name: 'Voyages', amount: 50.0, effective_bucket: 'cagnotte_projet', method: 'project_cagnotte' },
  { category_name: 'Repas voyage', parent_category_name: 'Voyages', amount: 10.0, effective_bucket: 'cagnotte_projet', method: 'project_cagnotte' },
  { category_name: 'Trajet', parent_category_name: 'Voyages', amount: 60.0, effective_bucket: 'cagnotte_projet', method: 'project_cagnotte' },
]
