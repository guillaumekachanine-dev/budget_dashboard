import { budgetDb } from '@/lib/supabaseBudget'
import { getBudgetPeriodByYearMonth } from '@/features/stats/api/getBudgetPeriodByYearMonth'

interface BudgetBucketPeriodRow {
  period_year?: number | string | null
  period_month?: number | string | null
}

export interface UsableStatsPeriod {
  id: string | null
  period_year: number
  period_month: number
  label: string | null
}

const STATS_REFERENCE_YEAR = 2026

function asFiniteNumber(value: unknown): number | null {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function normalizePeriodRows(rows: BudgetBucketPeriodRow[]): Array<{ period_year: number; period_month: number }> {
  const unique = new Map<string, { period_year: number; period_month: number }>()

  for (const row of rows) {
    const periodYear = asFiniteNumber(row.period_year)
    const periodMonth = asFiniteNumber(row.period_month)
    if (!periodYear || !periodMonth) continue
    if (periodMonth < 1 || periodMonth > 12) continue

    const key = `${periodYear}-${periodMonth}`
    if (!unique.has(key)) {
      unique.set(key, { period_year: periodYear, period_month: periodMonth })
    }
  }

  return [...unique.values()].sort((a, b) => {
    if (a.period_year !== b.period_year) return b.period_year - a.period_year
    return b.period_month - a.period_month
  })
}

export async function getUsableStatsMonthlyPeriods(userId: string, year = STATS_REFERENCE_YEAR): Promise<UsableStatsPeriod[]> {
  const { data, error } = await budgetDb()
    .from('budget_bucket_totals_by_period')
    .select('period_year, period_month')
    .eq('user_id', userId)
    .eq('period_year', year)
    .order('period_year', { ascending: false })
    .order('period_month', { ascending: false })

  if (error) {
    throw new Error(`getUsableStatsMonthlyPeriods failed: ${error.message}`)
  }

  console.info('[stats periods][temporary] getUsableStatsMonthlyPeriods raw data=', data ?? [])

  const normalized = normalizePeriodRows((data ?? []) as BudgetBucketPeriodRow[])
  const periods = await Promise.all(normalized.map(async (period) => {
    const resolvedPeriod = await getBudgetPeriodByYearMonth(period.period_year, period.period_month)
    return {
      id: resolvedPeriod?.id ?? null,
      period_year: period.period_year,
      period_month: period.period_month,
      label: resolvedPeriod?.label ?? null,
    } satisfies UsableStatsPeriod
  }))

  return periods.sort((a, b) => b.period_month - a.period_month)
}

export async function getLatestUsableStatsPeriod(userId: string): Promise<UsableStatsPeriod | null> {
  const periods = await getUsableStatsMonthlyPeriods(userId)
  return periods[0] ?? null
}

export async function hasUsableStatsPeriod(userId: string, periodYear: number, periodMonth: number): Promise<boolean> {
  const { data, error } = await budgetDb()
    .from('budget_bucket_totals_by_period')
    .select('period_year, period_month')
    .eq('user_id', userId)
    .eq('period_year', periodYear)
    .eq('period_month', periodMonth)
    .limit(1)

  if (error) {
    throw new Error(`hasUsableStatsPeriod failed: ${error.message}`)
  }

  return (data ?? []).length > 0
}
