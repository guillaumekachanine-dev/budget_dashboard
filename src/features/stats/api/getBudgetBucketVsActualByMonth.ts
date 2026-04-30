import { budgetDb } from '@/lib/supabaseBudget'
import type { BudgetBucketVsActualSourceRow } from '@/features/stats/types'

export async function getBudgetBucketVsActualByMonth(
  periodYear: number,
  periodMonth: number,
): Promise<BudgetBucketVsActualSourceRow[]> {
  const { data, error } = await budgetDb()
    .from('budget_bucket_budget_vs_actual_by_month')
    .select('*')
    .eq('period_year', periodYear)
    .eq('period_month', periodMonth)

  if (error) {
    throw new Error(`getBudgetBucketVsActualByMonth failed: ${error.message}`)
  }

  return (data ?? []) as BudgetBucketVsActualSourceRow[]
}
