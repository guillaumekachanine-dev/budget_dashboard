import { budgetDb } from '@/lib/supabaseBudget'
import type { BudgetBucketTotalSourceRow } from '@/features/stats/types'

export async function getBudgetBucketTotalsByPeriod(
  periodYear: number,
  periodMonth: number,
): Promise<BudgetBucketTotalSourceRow[]> {
  const { data, error } = await budgetDb()
    .from('budget_bucket_totals_by_period')
    .select('*')
    .eq('period_year', periodYear)
    .eq('period_month', periodMonth)

  if (error) {
    throw new Error(`getBudgetBucketTotalsByPeriod failed: ${error.message}`)
  }

  return (data ?? []) as BudgetBucketTotalSourceRow[]
}
