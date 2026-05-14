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

type AccountBalanceRow = {
  account_id: string
  current_balance: number | null
}

type TransactionRow = {
  account_id: string | null
  transaction_date: string | null
  amount: number | null
  direction: string | null
  raw_label: string | null
  normalized_label: string | null
  notes: string | null
}

const MAX_SERIES = 6

const LIVRET_LINE_COLORS = ['#2ED47A', '#3CD985', '#59E09A', '#1EB866'] as const
const PLACEMENT_LINE_COLORS = ['#FFAB2E', '#FFBC59', '#F7C789', '#E89E3B'] as const

function normalizeLabel(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
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

function signedAmount(direction: string | null, amountRaw: number | null): number {
  const amount = Number(amountRaw ?? 0)
  if (!Number.isFinite(amount)) return 0

  if (direction === 'income' || direction === 'transfer_in' || direction === 'savings') {
    return amount
  }

  return -amount
}

function toIsoDate(value: Date): string {
  return value.toISOString().slice(0, 10)
}

function toYearMonth(value: string): string {
  return value.slice(0, 7)
}

function monthKeys(startYear: number, endYear: number, endMonth: number): string[] {
  const out: string[] = []
  for (let year = startYear; year <= endYear; year += 1) {
    const maxMonth = year === endYear ? endMonth : 12
    for (let month = 1; month <= maxMonth; month += 1) {
      out.push(`${year}-${String(month).padStart(2, '0')}`)
    }
  }
  return out
}

function isInterestOperation(transaction: Pick<TransactionRow, 'raw_label' | 'normalized_label' | 'notes' | 'direction'>): boolean {
  const merged = [
    transaction.raw_label ?? '',
    transaction.normalized_label ?? '',
    transaction.notes ?? '',
  ]
    .join(' ')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
  if (merged.includes('interet') || merged.includes('interest')) return true
  return transaction.direction === 'income' && (merged.includes('epargne') || merged.includes('livret'))
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
  const currentMonth = now.getMonth() + 1
  const startDate = `${startYear}-01-01`
  const endDate = toIsoDate(now)

  try {
    const { data: accountsData, error: accountsError } = await budgetDb
      .from('accounts')
      .select('id,name,account_type,opening_balance')
      .eq('include_in_dashboard', true)

    if (accountsError) {
      throw new Error(`getSavingsEvolutionFiveYears accounts failed: ${accountsError.message}`)
    }

    const accounts = ((accountsData ?? []) as unknown as AccountRow[])
      .map((account) => ({
        ...account,
        family: resolveSavingsFamily(account.name, account.account_type),
      }))
      .filter((account) => account.family != null) as Array<AccountRow & { family: SavingsFamily }>

    if (accounts.length === 0) {
      return buildFallbackPayload(endYear)
    }

    const accountIds = accounts.map((account) => account.id)

    const [balancesResult, transactionsResult] = await Promise.all([
      budgetDb
        .from('account_balances')
        .select('account_id,current_balance')
        .in('account_id', accountIds),
      budgetDb
        .from('transactions')
        .select('account_id,transaction_date,amount,direction,raw_label,normalized_label,notes')
        .eq('is_hidden', false)
        .in('account_id', accountIds)
        .gte('transaction_date', startDate)
        .lte('transaction_date', endDate)
        .order('transaction_date', { ascending: true }),
    ])

    if (balancesResult.error) {
      throw new Error(`getSavingsEvolutionFiveYears balances failed: ${balancesResult.error.message}`)
    }

    if (transactionsResult.error) {
      throw new Error(`getSavingsEvolutionFiveYears transactions failed: ${transactionsResult.error.message}`)
    }

    const balances = (balancesResult.data ?? []) as unknown as AccountBalanceRow[]
    const transactions = (transactionsResult.data ?? []) as unknown as TransactionRow[]

    const currentBalanceById = new Map<string, number>()
    for (const row of balances) {
      const current = Number(row.current_balance ?? 0)
      if (!Number.isFinite(current)) continue
      currentBalanceById.set(row.account_id, current)
    }

    const txNetByAccountMonth = new Map<string, number>()
    const txNetSinceStartByAccount = new Map<string, number>()
    const yearlyAccountMetrics = new Map<string, { operationsCount: number; totalSavedAmount: number }>()
    const yearlyOperationEventByAccount = new Map<string, { transactionDate: string; amount: number; nature: 'virement' | 'intérêts' }>()

    for (const tx of transactions) {
      if (!tx.account_id || !tx.transaction_date || tx.transaction_date.length < 7) continue
      const delta = signedAmount(tx.direction, tx.amount)
      const monthKey = toYearMonth(tx.transaction_date)
      const yearKey = tx.transaction_date.slice(0, 4)
      const perMonthKey = `${tx.account_id}::${monthKey}`
      const perYearKey = `${tx.account_id}::${yearKey}`

      txNetByAccountMonth.set(perMonthKey, (txNetByAccountMonth.get(perMonthKey) ?? 0) + delta)
      txNetSinceStartByAccount.set(tx.account_id, (txNetSinceStartByAccount.get(tx.account_id) ?? 0) + delta)

      const previousMetrics = yearlyAccountMetrics.get(perYearKey) ?? { operationsCount: 0, totalSavedAmount: 0 }
      yearlyAccountMetrics.set(perYearKey, {
        operationsCount: previousMetrics.operationsCount + 1,
        totalSavedAmount: previousMetrics.totalSavedAmount + (delta > 0 ? delta : 0),
      })

      const interestOperation = isInterestOperation(tx)
      const isSavingsOperation = tx.direction === 'savings' || tx.direction === 'transfer_in' || interestOperation
      if (isSavingsOperation && delta > 0) {
        const previousEvent = yearlyOperationEventByAccount.get(perYearKey)
        if (!previousEvent || tx.transaction_date > previousEvent.transactionDate) {
          yearlyOperationEventByAccount.set(perYearKey, {
            transactionDate: tx.transaction_date,
            amount: Math.round(delta),
            nature: interestOperation ? 'intérêts' : 'virement',
          })
        }
      }
    }

    const selectedAccounts: Array<AccountRow & { family: SavingsFamily; currentBalance: number }> = [...accounts]
      .map((account) => {
        const currentBalance = currentBalanceById.get(account.id)
        const fallbackCurrent = Number(account.opening_balance ?? 0)
        const safeCurrent = typeof currentBalance === 'number' && Number.isFinite(currentBalance)
          ? currentBalance
          : (Number.isFinite(fallbackCurrent) ? fallbackCurrent : 0)
        return {
          ...account,
          currentBalance: safeCurrent,
        }
      })
      .filter((account) => account.currentBalance > 0)
      .sort((a, b) => b.currentBalance - a.currentBalance)
      .slice(0, MAX_SERIES)

    if (selectedAccounts.length === 0) {
      return buildFallbackPayload(endYear)
    }

    const livretColorCursor = { value: 0 }
    const placementColorCursor = { value: 0 }

    const series: SavingsEvolutionFiveYearsSeries[] = selectedAccounts.map((account) => {
      const color = account.family === 'livrets'
        ? LIVRET_LINE_COLORS[livretColorCursor.value++ % LIVRET_LINE_COLORS.length]
        : PLACEMENT_LINE_COLORS[placementColorCursor.value++ % PLACEMENT_LINE_COLORS.length]

      return {
        key: account.id,
        label: account.name,
        color,
        family: account.family,
      }
    })

    const months = monthKeys(startYear, endYear, currentMonth)

    const yearlyPoints = new Map<string, SavingsEvolutionFiveYearsRow>()
    for (let year = startYear; year <= endYear; year += 1) {
      yearlyPoints.set(String(year), { year: String(year) })
    }

    for (const account of selectedAccounts) {
      const netSinceStart = txNetSinceStartByAccount.get(account.id) ?? 0
      let runningBalance = account.currentBalance - netSinceStart

      for (const month of months) {
        const netForMonth = txNetByAccountMonth.get(`${account.id}::${month}`) ?? 0
        runningBalance += netForMonth

        const [year, monthRaw] = month.split('-')
        if (!year || !monthRaw) continue
        const yearNumeric = Number(year)
        const monthNumeric = Number(monthRaw)
        const isSnapshotMonth = yearNumeric < endYear
          ? monthNumeric === 12
          : monthNumeric === currentMonth

        if (!isSnapshotMonth) continue

        const row = yearlyPoints.get(year)
        if (!row) continue
        row[account.id] = Math.max(0, Math.round(runningBalance))
      }
    }

    const rows = [...yearlyPoints.values()].map((row) => {
      const normalizedRow: SavingsEvolutionFiveYearsRow = { year: row.year }
      for (const item of series) {
        const value = Number(row[item.key] ?? 0)
        normalizedRow[item.key] = Number.isFinite(value) ? value : 0
      }
      return normalizedRow
    })

    const yearlyMetricsPayload: SavingsEvolutionFiveYearsPayload['yearly_account_metrics'] = {}
    const operationEvents: SavingsEvolutionFiveYearsPayload['operation_events'] = []
    for (const account of selectedAccounts) {
      for (let year = startYear; year <= endYear; year += 1) {
        const key = `${account.id}::${year}`
        const source = yearlyAccountMetrics.get(key) ?? { operationsCount: 0, totalSavedAmount: 0 }
        yearlyMetricsPayload[key] = {
          operations_count: source.operationsCount,
          total_saved_amount: Math.round(source.totalSavedAmount),
        }

        const event = yearlyOperationEventByAccount.get(key)
        if (event) {
          operationEvents.push({
            id: `${account.id}-${year}-${event.transactionDate}`,
            account_key: account.id,
            account_label: account.name,
            year: String(year),
            transaction_date: event.transactionDate,
            amount: event.amount,
            nature: event.nature,
          })
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
