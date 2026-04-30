import { budgetDb } from '@/lib/supabaseBudget'
import { getBudgetPeriodByYearMonth } from '@/features/stats/api/getBudgetPeriodByYearMonth'

interface BudgetBucketPeriodRow {
  period_year: number
  period_month: number
}

export interface UsableStatsPeriod {
  id: string | null
  period_year: number
  period_month: number
  label: string | null
}

export async function getLatestUsableStatsPeriod(): Promise<UsableStatsPeriod | null> {
  const { data, error } = await budgetDb()
    .from('budget_bucket_totals_by_period')
    .select('period_year, period_month')
    .order('period_year', { ascending: false })
    .order('period_month', { ascending: false })
    .limit(1)

  if (error) {
    throw new Error(`getLatestUsableStatsPeriod failed: ${error.message}`)
  }

  const latestBucketPeriod = ((data ?? [])[0] ?? null) as BudgetBucketPeriodRow | null
  if (!latestBucketPeriod) return null

  const periodFromBudgetPeriods = await getBudgetPeriodByYearMonth(
    Number(latestBucketPeriod.period_year),
    Number(latestBucketPeriod.period_month),
  )

  if (periodFromBudgetPeriods) {
    return periodFromBudgetPeriods
  }

  return {
    id: null,
    period_year: Number(latestBucketPeriod.period_year),
    period_month: Number(latestBucketPeriod.period_month),
    label: null,
  }
}

export async function hasUsableStatsPeriod(periodYear: number, periodMonth: number): Promise<boolean> {
  const { data, error } = await budgetDb()
    .from('budget_bucket_totals_by_period')
    .select('period_year, period_month')
    .eq('period_year', periodYear)
    .eq('period_month', periodMonth)
    .limit(1)

  if (error) {
    throw new Error(`hasUsableStatsPeriod failed: ${error.message}`)
  }

  return (data ?? []).length > 0
}
