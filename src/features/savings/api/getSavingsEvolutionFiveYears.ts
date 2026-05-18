import { budgetDb } from '@/lib/supabaseBudget'
import type {
  SavingsEvolutionFiveYearsPayload,
  SavingsEvolutionFiveYearsRow,
  SavingsEvolutionFiveYearsSeries,
  SavingsRiskLevel,
} from '@/features/savings/types'
import { resolveSavingsPortfolioColor } from '@/features/savings/utils/savingsPortfolioColor'

type SavingsFamily = 'livrets' | 'placements'

type ConfigRow = {
  account_id: string
  display_name: string | null
  savings_family: string | null
  savings_kind: string | null
  risk_level: SavingsRiskLevel | null
  current_balance: number | null
}

type SnapshotRow = {
  account_id: string
  snapshot_date: string
  balance_eur: number | null
  total_saved_eur: number | null
  operations_count: number | null
}

type OperationsViewRow = {
  transaction_id: string
  transaction_date: string
  destination_account_id: string | null
  destination_account_name: string | null
  amount: string | number | null
  normalized_label: string | null
  category_name: string | null
  direction: string | null
}

const MAX_SERIES = 6

function normalizeLabelStr(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

function toNatureFromView(
  normalizedLabel: string | null,
  categoryName: string | null,
): 'virement' | 'intérêts' {
  const lbl = normalizeLabelStr(normalizedLabel ?? '')
  const cat = normalizeLabelStr(categoryName ?? '')
  if (
    cat.includes('interet')
    || lbl.includes('interet')
    || cat.includes('dividende')
    || lbl.includes('dividende')
  ) {
    return 'intérêts'
  }
  return 'virement'
}

function toIsoDate(value: Date): string {
  return value.toISOString().slice(0, 10)
}

function buildFallbackPayload(endYear: number): SavingsEvolutionFiveYearsPayload {
  const years = Array.from({ length: 5 }, (_, index) => String(endYear - 4 + index))

  const series: SavingsEvolutionFiveYearsSeries[] = [
    {
      key: 'livret_a',
      label: 'Livret A',
      color: resolveSavingsPortfolioColor({ key: 'livret_a', label: 'Livret A', savingsKind: 'livret_a' }),
      family: 'livrets',
      savings_kind: 'livret_a',
      risk_level: null,
    },
    {
      key: 'ldds',
      label: 'LDDS',
      color: resolveSavingsPortfolioColor({ key: 'ldds', label: 'LDDS', savingsKind: 'ldds' }),
      family: 'livrets',
      savings_kind: 'ldds',
      risk_level: null,
    },
    {
      key: 'pea',
      label: 'PEA',
      color: resolveSavingsPortfolioColor({ key: 'pea', label: 'PEA', savingsKind: 'pea' }),
      family: 'placements',
      savings_kind: 'pea',
      risk_level: 'medium',
    },
    {
      key: 'per',
      label: 'PER',
      color: resolveSavingsPortfolioColor({ key: 'per', label: 'PER', savingsKind: 'per' }),
      family: 'placements',
      savings_kind: 'per',
      risk_level: 'low',
    },
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
    const [accountsResult, snapshotsResult, operationsResult] = await Promise.all([
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (budgetDb as any)
        .from('v_savings_accounts_display')
        .select('account_id,display_name,savings_family,savings_kind,risk_level,current_balance')
        .order('display_order', { ascending: true }),
      budgetDb
        .from('savings_balance_snapshots')
        .select('account_id,snapshot_date,balance_eur,total_saved_eur,operations_count')
        .not('balance_eur', 'is', null)
        .gte('snapshot_date', startDate)
        .lte('snapshot_date', endDate)
        .order('snapshot_date', { ascending: true }),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (budgetDb as any)
        .from('v_savings_transfers_enriched')
        .select('transaction_id,transaction_date,destination_account_id,destination_account_name,amount,normalized_label,category_name,direction')
        .order('transaction_date', { ascending: true }),
    ])

    if (accountsResult.error) {
      throw new Error(`getSavingsEvolutionFiveYears accounts: ${accountsResult.error.message}`)
    }
    if (snapshotsResult.error) {
      throw new Error(`getSavingsEvolutionFiveYears snapshots: ${snapshotsResult.error.message}`)
    }
    if (operationsResult.error) {
      throw new Error(`getSavingsEvolutionFiveYears operations: ${operationsResult.error.message}`)
    }

    const accounts = ((accountsResult.data ?? []) as unknown as ConfigRow[])
      .filter((a): a is ConfigRow & { savings_family: SavingsFamily } =>
        a.savings_family === 'livrets' || a.savings_family === 'placements'
      )

    const snapshots = (snapshotsResult.data ?? []) as unknown as SnapshotRow[]
    const allOperations = (operationsResult.data ?? []) as unknown as OperationsViewRow[]

    if (accounts.length === 0) {
      return buildFallbackPayload(endYear)
    }

    const selectedAccounts = accounts
      .filter((a) => (a.current_balance ?? 0) > 0)
      .sort((a, b) => (b.current_balance ?? 0) - (a.current_balance ?? 0))
      .slice(0, MAX_SERIES)

    if (selectedAccounts.length === 0) {
      return buildFallbackPayload(endYear)
    }

    const selectedAccountIds = new Set(selectedAccounts.map((a) => a.account_id))

    // For each (account_id × year): latest snapshot balance (ordered ASC → last write wins per year)
    type YearSnap = {
      balance_eur: number
      total_saved_eur: number
      operations_count: number
    }
    const snapByAccountYear = new Map<string, YearSnap>()

    for (const snap of snapshots) {
      if (!selectedAccountIds.has(snap.account_id)) continue
      const year = snap.snapshot_date.slice(0, 4)
      snapByAccountYear.set(`${snap.account_id}::${year}`, {
        balance_eur: Number(snap.balance_eur ?? 0),
        total_saved_eur: Number(snap.total_saved_eur ?? 0),
        operations_count: Number(snap.operations_count ?? 0),
      })
    }

    // Series
    const series: SavingsEvolutionFiveYearsSeries[] = selectedAccounts.map((a) => {
      return {
        key: a.account_id,
        label: a.display_name ?? a.account_id,
        color: resolveSavingsPortfolioColor({
          key: a.account_id,
          label: a.display_name ?? a.account_id,
          savingsKind: a.savings_kind ?? '',
        }),
        family: a.savings_family,
        savings_kind: a.savings_kind ?? '',
        risk_level: a.risk_level ?? null,
      }
    })

    // Rows: one entry per year, one column per account
    const yearlyPoints = new Map<string, SavingsEvolutionFiveYearsRow>()
    for (let y = startYear; y <= endYear; y++) {
      yearlyPoints.set(String(y), { year: String(y) })
    }
    for (const account of selectedAccounts) {
      for (let y = startYear; y <= endYear; y++) {
        const snap = snapByAccountYear.get(`${account.account_id}::${y}`)
        if (snap) {
          const row = yearlyPoints.get(String(y))
          if (row) row[account.account_id] = Math.max(0, Math.round(snap.balance_eur))
        }
      }
      // Accounts with no current-year snapshot: carry forward current_balance from the view
      const currentYearRow = yearlyPoints.get(String(endYear))
      if (currentYearRow && currentYearRow[account.account_id] === undefined && (account.current_balance ?? 0) > 0) {
        currentYearRow[account.account_id] = Math.round(account.current_balance!)
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
        // Key absent → Recharts treats the point as null (connectNulls bridges over it)
      }
      return out
    })

    // Yearly metrics from snapshots (operations count + total saved per account × year)
    const yearlyMetricsPayload: SavingsEvolutionFiveYearsPayload['yearly_account_metrics'] = {}
    for (const account of selectedAccounts) {
      for (let y = startYear; y <= endYear; y++) {
        const key = `${account.account_id}::${y}`
        const snap = snapByAccountYear.get(key)
        yearlyMetricsPayload[key] = {
          operations_count: snap?.operations_count ?? 0,
          total_saved_amount: Math.round(snap?.total_saved_eur ?? 0),
        }
      }
    }

    // Operation events: ALL operations from v_savings_transfers_enriched for selected accounts
    const operationEvents: SavingsEvolutionFiveYearsPayload['operation_events'] = []
    for (const op of allOperations) {
      if (!op.destination_account_id) continue
      if (!selectedAccountIds.has(op.destination_account_id)) continue

      const rawAmount = Math.round(Number(op.amount ?? 0))
      if (rawAmount === 0) continue

      const nature = toNatureFromView(op.normalized_label, op.category_name)
      // Withdrawals (direction='expense') are stored as positive but represent outflows
      const amount = op.direction === 'expense' ? -rawAmount : rawAmount
      const year = op.transaction_date.slice(0, 4)
      const account = selectedAccounts.find((a) => a.account_id === op.destination_account_id)

      operationEvents.push({
        id: op.transaction_id,
        account_key: op.destination_account_id,
        account_label: account?.display_name ?? op.destination_account_name ?? '',
        year,
        transaction_date: op.transaction_date,
        amount,
        nature,
      })
    }

    return {
      rows,
      series,
      yearly_account_metrics: yearlyMetricsPayload,
      operation_events: operationEvents,
      isFallback: false,
    }
  } catch (err) {
    console.error('[getSavingsEvolutionFiveYears] fallback triggered:', err)
    return buildFallbackPayload(endYear)
  }
}
