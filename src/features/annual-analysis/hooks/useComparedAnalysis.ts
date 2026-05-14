import { useQueries } from '@tanstack/react-query'
import { getComparedYtdFlows } from '@/features/annual-analysis/api/getComparedYtdFlows'
import { getComparedBucketSummary } from '@/features/annual-analysis/api/getComparedBucketSummary'
import { getComparedCategorySummary } from '@/features/annual-analysis/api/getComparedCategorySummary'
import type {
  ComparedAnalysis,
  ComparedBucketMetric,
  ComparedCategoryMetric,
  ComparedFluxMetric,
  YtdBucketRow,
  YtdCategoryRow,
  YtdFlowRow,
  YtdFlowSummary,
} from '@/features/annual-analysis/types.compared'
import { COMPARED_MONTHS } from '@/features/annual-analysis/types.compared'

const STALE = 15 * 60_000

// ─── Helpers ──────────────────────────────────────────────────────────────────

function normalizeComparedBucketKey(bucket: string): string {
  const key = bucket.trim().toLowerCase()

  if (key.includes('variable')) return 'variable_essentielle'
  if (key.includes('socle') || key.includes('fixe')) return 'socle_fixe'
  if (key.includes('epargne') || key.includes('cagnotte') || key.includes('savings')) return 'epargne'
  if (key.includes('discretion')) return 'discretionnaire'
  if (key.includes('provision')) return 'provision'

  return key
}

/** Médiane d'un tableau de nombres (robuste aux valeurs atypiques) */
function median(values: number[]): number | null {
  if (values.length === 0) return null
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 1
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2
}

function safePct(numerator: number, denominator: number): number | null {
  if (denominator === 0) return null
  return ((numerator - denominator) / denominator) * 100
}

function sumRows(rows: YtdFlowRow[], field: keyof YtdFlowRow): number {
  return rows.reduce((acc, r) => acc + (r[field] as number), 0)
}

// ─── Agrégation flux YTD par année ───────────────────────────────────────────

function buildFlowSummary(
  rows: YtdFlowRow[],
  year: 2025 | 2026,
): YtdFlowSummary | null {
  const yearRows = rows.filter((r) => r.period_year === year)
  if (yearRows.length === 0) return null

  const expense_total          = sumRows(yearRows, 'expense_total')
  const income_total           = sumRows(yearRows, 'income_total')
  const fixed_expense_total    = sumRows(yearRows, 'fixed_expense_total')
  const variable_expense_total = sumRows(yearRows, 'variable_expense_total')
  const savings_total          = sumRows(yearRows, 'savings_realized_total')

  return {
    year,
    expense_total,
    income_total,
    fixed_expense_total,
    variable_expense_total,
    savings_total,
    net_cashflow: income_total - expense_total,
    months: yearRows,
  }
}

// ─── Métriques flux comparées ─────────────────────────────────────────────────

function buildFluxMetrics(
  s2025: YtdFlowSummary | null,
  s2026: YtdFlowSummary | null,
): ComparedFluxMetric[] {
  const def = (v: number | undefined) => v ?? 0

  const metrics: Array<{ label: string; key: keyof YtdFlowSummary; positive_is: 'up' | 'down' }> = [
    { label: 'Revenus',        key: 'income_total',           positive_is: 'up' },
    { label: 'Dépenses',       key: 'expense_total',          positive_is: 'down' },
    { label: 'Socle fixe',     key: 'fixed_expense_total',    positive_is: 'down' },
    { label: 'Variable',       key: 'variable_expense_total', positive_is: 'down' },
    { label: 'Cashflow net',   key: 'net_cashflow',           positive_is: 'up' },
    { label: 'Épargne réalisée', key: 'savings_total',        positive_is: 'up' },
  ]

  return metrics.map(({ label, key, positive_is }) => {
    const v2025 = def(s2025?.[key] as number | undefined)
    const v2026 = def(s2026?.[key] as number | undefined)
    return {
      label,
      value_2025:  v2025,
      value_2026:  v2026,
      delta_eur:   v2026 - v2025,
      delta_pct:   safePct(v2026, v2025),
      positive_is,
    }
  })
}

// ─── Métriques catégories comparées ──────────────────────────────────────────

function buildCategoryMetrics(rows: YtdCategoryRow[]): ComparedCategoryMetric[] {
  // Agrégat par (parent_category_name, year)
  const map = new Map<string, { total_2025: number; total_2026: number }>()

  for (const row of rows) {
    const key = row.parent_category_name ?? row.category_name
    const entry = map.get(key) ?? { total_2025: 0, total_2026: 0 }
    if (row.period_year === 2025) entry.total_2025 += row.amount_total
    if (row.period_year === 2026) entry.total_2026 += row.amount_total
    map.set(key, entry)
  }

  return [...map.entries()]
    .map(([parent_category_name, { total_2025, total_2026 }]) => ({
      parent_category_name,
      total_2025,
      total_2026,
      delta_eur: total_2026 - total_2025,
      delta_pct: safePct(total_2026, total_2025),
    }))
    .sort((a, b) => b.total_2026 - a.total_2026)
}

// ─── Métriques buckets comparées ─────────────────────────────────────────────

function buildBucketMetrics(
  rows: YtdBucketRow[],
  flows2025: YtdFlowSummary | null,
  flows2026: YtdFlowSummary | null,
): ComparedBucketMetric[] {
  const map = new Map<string, {
    actual_2025: number; actual_2026: number
    target_2026: number; ratio_2026_sum: number; ratio_2026_count: number
  }>()

  for (const row of rows) {
    const normalizedBucket = normalizeComparedBucketKey(row.budget_bucket)
    const entry = map.get(normalizedBucket) ?? {
      actual_2025: 0, actual_2026: 0,
      target_2026: 0, ratio_2026_sum: 0, ratio_2026_count: 0,
    }
    if (row.period_year === 2025) entry.actual_2025 += row.actual_budget_bucket_eur
    if (row.period_year === 2026) {
      entry.actual_2026 += row.actual_budget_bucket_eur
      entry.target_2026 += row.target_budget_bucket_eur
      entry.ratio_2026_sum += row.consumption_ratio
      entry.ratio_2026_count += 1
    }
    map.set(normalizedBucket, entry)
  }

  const ensureDerivedBucket = (bucket: string, actual2025: number, actual2026: number) => {
    const existing = map.get(bucket)
    const existingMagnitude = existing ? Math.abs(existing.actual_2025) + Math.abs(existing.actual_2026) : 0
    if (existingMagnitude >= 1) return

    map.set(bucket, {
      actual_2025: actual2025,
      actual_2026: actual2026,
      target_2026: existing?.target_2026 ?? 0,
      ratio_2026_sum: existing?.ratio_2026_sum ?? 0,
      ratio_2026_count: existing?.ratio_2026_count ?? 0,
    })
  }

  const syncBucketActualWithFlow = (bucket: string, actual2025: number, actual2026: number) => {
    const existing = map.get(bucket)
    map.set(bucket, {
      actual_2025: actual2025,
      actual_2026: actual2026,
      target_2026: existing?.target_2026 ?? 0,
      ratio_2026_sum: existing?.ratio_2026_sum ?? 0,
      ratio_2026_count: existing?.ratio_2026_count ?? 0,
    })
  }

  ensureDerivedBucket(
    'variable_essentielle',
    flows2025?.variable_expense_total ?? 0,
    flows2026?.variable_expense_total ?? 0,
  )
  // Pour "épargne", on impose la même source que les flux (transactions réalisées),
  // même si la vue bucket expose une valeur différente.
  syncBucketActualWithFlow(
    'epargne',
    flows2025?.savings_total ?? 0,
    flows2026?.savings_total ?? 0,
  )

  return [...map.entries()]
    .map(([bucket, d]) => ({
      bucket,
      actual_2025:          d.actual_2025,
      actual_2026:          d.actual_2026,
      target_2026:          d.target_2026,
      delta_eur:            d.actual_2026 - d.actual_2025,
      delta_pct:            safePct(d.actual_2026, d.actual_2025),
      consumption_ratio_2026: d.ratio_2026_count > 0
        ? d.ratio_2026_sum / d.ratio_2026_count
        : 0,
    }))
}

// ─── Hook principal ───────────────────────────────────────────────────────────

export function useComparedAnalysis(): ComparedAnalysis {
  const [flowsQ, bucketsQ, categoriesQ] = useQueries({
    queries: [
      {
        queryKey: ['compared-ytd-flows', COMPARED_MONTHS],
        queryFn:  getComparedYtdFlows,
        staleTime: STALE,
      },
      {
        queryKey: ['compared-bucket-summary', COMPARED_MONTHS],
        queryFn:  getComparedBucketSummary,
        staleTime: STALE,
      },
      {
        queryKey: ['compared-category-summary', COMPARED_MONTHS],
        queryFn:  getComparedCategorySummary,
        staleTime: STALE,
      },
    ],
  })

  const loading = flowsQ.isPending || bucketsQ.isPending || categoriesQ.isPending
  const error   = flowsQ.error?.message
    ?? bucketsQ.error?.message
    ?? categoriesQ.error?.message
    ?? null

  const flowRows     = flowsQ.data      ?? []
  const bucketRows   = bucketsQ.data    ?? []
  const categoryRows = categoriesQ.data ?? []

  // Dérivé pendant le rendu — pas d'effet, pas de state (rerender-derived-state-no-effect)
  const flows2025 = buildFlowSummary(flowRows, 2025)
  const flows2026 = buildFlowSummary(flowRows, 2026)

  const fluxMetrics     = buildFluxMetrics(flows2025, flows2026)
  const categoryMetrics = buildCategoryMetrics(categoryRows)
  const bucketMetrics   = buildBucketMetrics(bucketRows, flows2025, flows2026)

  const nbMonths       = COMPARED_MONTHS.length
  const remainingMonths = 12 - nbMonths  // mois non encore écoulés dans l'année

  // Médiane des dépenses mensuelles sur la fenêtre Jan-Avr
  const medianMonthly2025 = flows2025
    ? median(flows2025.months.map((m) => m.expense_total))
    : null
  const medianMonthly2026 = flows2026
    ? median(flows2026.months.map((m) => m.expense_total))
    : null

  // Projection = consommé réel YTD + (médiane × mois restants)
  const projectedExpense2025 = flows2025 != null && medianMonthly2025 != null
    ? flows2025.expense_total + medianMonthly2025 * remainingMonths
    : null
  const projectedExpense2026 = flows2026 != null && medianMonthly2026 != null
    ? flows2026.expense_total + medianMonthly2026 * remainingMonths
    : null

  return {
    loading,
    error,
    flowRows,
    bucketRows,
    categoryRows,
    flows2025,
    flows2026,
    fluxMetrics,
    categoryMetrics,
    bucketMetrics,
    projectedExpense2025,
    projectedExpense2026,
    medianMonthly2025,
    medianMonthly2026,
    remainingMonths,
  }
}
