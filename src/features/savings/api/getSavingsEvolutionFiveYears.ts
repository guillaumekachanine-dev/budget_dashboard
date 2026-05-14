import { budgetDb } from '@/lib/supabaseBudget'
import type {
  SavingsEvolutionFiveYearsPayload,
  SavingsEvolutionFiveYearsRow,
  SavingsEvolutionFiveYearsSeries,
} from '@/features/savings/types'

type SavingsFamily = 'livrets' | 'placements'

type AccountRow = {
  id: string
  name: string
  account_type: string | null
  opening_balance: number | null
}

type SnapshotRow = {
  account_id: string
  snapshot_date: string
  balance_eur: number | null
  total_saved_eur: number | null
  operations_count: number | null
  notable_date: string | null
  notable_nature: string | null
  notable_amount_eur: number | null
}

const MAX_SERIES = 6

const LIVRET_LINE_COLORS = ['#2ED47A', '#3CD985', '#59E09A', '#1EB866'] as const
const PLACEMENT_LINE_COLORS = ['#FFAB2E', '#FFBC59', '#F7C789', '#E89E3B'] as const

function normalizeLabel(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

function hasWord(normalized: string, word: string): boolean {
  const pattern = new RegExp(`\\b${word}\\b`, 'i')
  return pattern.test(normalized)
}

function resolveSavingsFamily(name: string, accountType: string | null): SavingsFamily | null {
  const normalized = normalizeLabel(name)

  const isPer = hasWord(normalized, 'per') || normalized.includes('plan epargne retraite')
  const isPercol = hasWord(normalized, 'percol') || hasWord(normalized, 'perco') || hasWord(normalized, 'peg') || normalized.includes('capgemini')
  if (
    hasWord(normalized, 'pea')
    || isPer
    || isPercol
    || normalized.includes('placement')
    || normalized.includes('assurance vie')
    || normalized.includes('crypto')
    || normalized.includes('amundi')
    || hasWord(normalized, 'cto')
  ) {
    return 'placements'
  }

  if (normalized.includes('livret') || hasWord(normalized, 'ldds') || hasWord(normalized, 'lep')) {
    return 'livrets'
  }

  if (accountType === 'savings') {
    return normalized.includes('epargne') ? 'livrets' : 'placements'
  }

  return null
}

function toFrontendNature(raw: string | null): 'virement' | 'intérêts' | null {
  if (!raw) return null
  if (raw === 'virement' || raw === 'abondement_entreprise') return 'virement'
  if (raw === 'intérêts' || raw === 'dividendes') return 'intérêts'
  return null
}

function toIsoDate(value: Date): string {
  return value.toISOString().slice(0, 10)
}

function buildFallbackPayload(endYear: number): SavingsEvolutionFiveYearsPayload {
  const years = Array.from({ length: 5 }, (_, index) => String(endYear - 4 + index))

  const series: SavingsEvolutionFiveYearsSeries[] = [
    { key: 'livret_a', label: 'Livret A', color: LIVRET_LINE_COLORS[0], family: 'livrets' },
    { key: 'ldds', label: 'LDDS', color: LIVRET_LINE_COLORS[1], family: 'livrets' },
    { key: 'pea', label: 'PEA', color: PLACEMENT_LINE_COLORS[0], family: 'placements' },
    { key: 'per', label: 'PER', color: PLACEMENT_LINE_COLORS[1], family: 'placements' },
  ]

  const baseRows = [
    { livret_a: 9800, ldds: 3200, pea: 7300, per: 5400 },
    { livret_a: 11200, ldds: 4200, pea: 9600, per: 5900 },
    { livret_a: 12450, ldds: 5200, pea: 12800, per: 6550 },
    { livret_a: 14100, ldds: 6400, pea: 15700, per: 7080 },
    { livret_a: 15600, ldds: 7600, pea: 18900, per: 7600 },
  ]

  const rows: SavingsEvolutionFiveYearsRow[] = years.map((year, index) => ({
    year,
    ...baseRows[index],
  }))

  const yearlyAccountMetrics: SavingsEvolutionFiveYearsPayload['yearly_account_metrics'] = {}
  const fallbackOperationEvents: SavingsEvolutionFiveYearsPayload['operation_events'] = []
  years.forEach((year, index) => {
    const livretATotal = [820, 980, 1120, 1280, 1410][index] ?? 0
    const lddsTotal = [340, 420, 540, 620, 700][index] ?? 0
    const peaTotal = [1450, 1610, 1820, 2050, 2380][index] ?? 0
    const perTotal = [740, 790, 860, 940, 1020][index] ?? 0

    yearlyAccountMetrics[`livret_a::${year}`] = { operations_count: 14, total_saved_amount: livretATotal }
    yearlyAccountMetrics[`ldds::${year}`] = { operations_count: 9, total_saved_amount: lddsTotal }
    yearlyAccountMetrics[`pea::${year}`] = { operations_count: 18, total_saved_amount: peaTotal }
    yearlyAccountMetrics[`per::${year}`] = { operations_count: 11, total_saved_amount: perTotal }

    fallbackOperationEvents.push(
      {
        id: `fallback-livret_a-${year}`,
        account_key: 'livret_a',
        account_label: 'Livret A',
        year,
        transaction_date: `${year}-03-15`,
        amount: 420,
        nature: 'intérêts',
      },
      {
        id: `fallback-pea-${year}`,
        account_key: 'pea',
        account_label: 'PEA',
        year,
        transaction_date: `${year}-09-10`,
        amount: 950,
        nature: 'virement',
      },
    )
  })

  return {
    rows,
    series,
    yearly_account_metrics: yearlyAccountMetrics,
    operation_events: fallbackOperationEvents,
    isFallback: true,
  }
}

export async function getSavingsEvolutionFiveYears(): Promise<SavingsEvolutionFiveYearsPayload> {
  const now = new Date()
  const endYear = now.getFullYear()
  const startYear = endYear - 4
  const startDate = `${startYear}-01-01`
  const endDate = toIsoDate(now)

  try {
    const [accountsResult, snapshotsResult] = await Promise.all([
      budgetDb
        .from('accounts')
        .select('id,name,account_type,opening_balance')
        .eq('include_in_dashboard', true),
      budgetDb
        .from('savings_balance_snapshots')
        .select('account_id,snapshot_date,balance_eur,total_saved_eur,operations_count,notable_date,notable_nature,notable_amount_eur')
        .not('balance_eur', 'is', null)
        .gte('snapshot_date', startDate)
        .lte('snapshot_date', endDate)
        .order('snapshot_date', { ascending: true }),
    ])

    if (accountsResult.error) {
      throw new Error(`getSavingsEvolutionFiveYears accounts: ${accountsResult.error.message}`)
    }
    if (snapshotsResult.error) {
      throw new Error(`getSavingsEvolutionFiveYears snapshots: ${snapshotsResult.error.message}`)
    }

    const accounts = ((accountsResult.data ?? []) as unknown as AccountRow[])
      .map((a) => ({ ...a, family: resolveSavingsFamily(a.name, a.account_type) }))
      .filter((a): a is AccountRow & { family: SavingsFamily } => a.family != null)

    const snapshots = (snapshotsResult.data ?? []) as unknown as SnapshotRow[]

    if (accounts.length === 0 || snapshots.length === 0) {
      return buildFallbackPayload(endYear)
    }

    // Latest balance per account (snapshots ordered ASC → last write wins)
    const latestBalanceByAccount = new Map<string, number>()
    for (const snap of snapshots) {
      latestBalanceByAccount.set(snap.account_id, Number(snap.balance_eur ?? 0))
    }

    const selectedAccounts = accounts
      .filter((a) => (latestBalanceByAccount.get(a.id) ?? 0) > 0)
      .sort((a, b) => (latestBalanceByAccount.get(b.id) ?? 0) - (latestBalanceByAccount.get(a.id) ?? 0))
      .slice(0, MAX_SERIES)

    if (selectedAccounts.length === 0) {
      return buildFallbackPayload(endYear)
    }

    const selectedAccountIds = new Set(selectedAccounts.map((a) => a.id))

    // For each (account_id × year): latest snapshot (ordered ASC → last write wins per year)
    type YearSnap = {
      balance_eur: number
      total_saved_eur: number
      operations_count: number
      notable_date: string | null
      notable_nature: string | null
      notable_amount_eur: number
    }
    const snapByAccountYear = new Map<string, YearSnap>()

    for (const snap of snapshots) {
      if (!selectedAccountIds.has(snap.account_id)) continue
      const year = snap.snapshot_date.slice(0, 4)
      snapByAccountYear.set(`${snap.account_id}::${year}`, {
        balance_eur: Number(snap.balance_eur ?? 0),
        total_saved_eur: Number(snap.total_saved_eur ?? 0),
        operations_count: Number(snap.operations_count ?? 0),
        notable_date: snap.notable_date,
        notable_nature: snap.notable_nature,
        notable_amount_eur: Number(snap.notable_amount_eur ?? 0),
      })
    }

    // Series
    const livretColorCursor = { value: 0 }
    const placementColorCursor = { value: 0 }
    const series: SavingsEvolutionFiveYearsSeries[] = selectedAccounts.map((a) => {
      const color = a.family === 'livrets'
        ? LIVRET_LINE_COLORS[livretColorCursor.value++ % LIVRET_LINE_COLORS.length]
        : PLACEMENT_LINE_COLORS[placementColorCursor.value++ % PLACEMENT_LINE_COLORS.length]
      return { key: a.id, label: a.name, color, family: a.family }
    })

    // Rows: one entry per year, one column per account
    const yearlyPoints = new Map<string, SavingsEvolutionFiveYearsRow>()
    for (let y = startYear; y <= endYear; y++) {
      yearlyPoints.set(String(y), { year: String(y) })
    }
    for (const account of selectedAccounts) {
      for (let y = startYear; y <= endYear; y++) {
        const snap = snapByAccountYear.get(`${account.id}::${y}`)
        if (!snap) continue
        const row = yearlyPoints.get(String(y))
        if (row) row[account.id] = Math.max(0, Math.round(snap.balance_eur))
      }
    }

    const rows = [...yearlyPoints.values()].map((row) => {
      const out: SavingsEvolutionFiveYearsRow = { year: row.year }
      for (const s of series) {
        const raw = row[s.key]
        if (raw !== undefined) {
          const v = Number(raw)
          out[s.key] = Number.isFinite(v) ? v : 0
        }
        // Clé absente → Recharts traite le point comme null (connectNulls bridge par-dessus)
      }
      return out
    })

    // Metrics + operation events
    const yearlyMetricsPayload: SavingsEvolutionFiveYearsPayload['yearly_account_metrics'] = {}
    const operationEvents: SavingsEvolutionFiveYearsPayload['operation_events'] = []

    for (const account of selectedAccounts) {
      for (let y = startYear; y <= endYear; y++) {
        const key = `${account.id}::${y}`
        const snap = snapByAccountYear.get(key)
        yearlyMetricsPayload[key] = {
          operations_count: snap?.operations_count ?? 0,
          total_saved_amount: Math.round(snap?.total_saved_eur ?? 0),
        }
        if (snap?.notable_date) {
          const nature = toFrontendNature(snap.notable_nature)
          if (nature && snap.notable_amount_eur > 0) {
            operationEvents.push({
              id: `${account.id}-${y}-${snap.notable_date}`,
              account_key: account.id,
              account_label: account.name,
              year: String(y),
              transaction_date: snap.notable_date,
              amount: Math.round(snap.notable_amount_eur),
              nature,
            })
          }
        }
      }
    }

    return {
      rows,
      series,
      yearly_account_metrics: yearlyMetricsPayload,
      operation_events: operationEvents,
      isFallback: false,
    }
  } catch {
    return buildFallbackPayload(endYear)
  }
}
