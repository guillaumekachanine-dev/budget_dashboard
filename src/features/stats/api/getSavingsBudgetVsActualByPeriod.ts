import { budgetDb } from '@/lib/supabaseBudget'
import type { SavingsBudgetVsActualSourceRow } from '@/features/stats/types'

export async function getSavingsBudgetVsActualByPeriod(
  periodYear: number,
  periodMonth: number,
): Promise<SavingsBudgetVsActualSourceRow[]> {
  const { data, error } = await budgetDb()
    .from('savings_budget_vs_actual_by_period')
    .select('*')
    .eq('period_year', periodYear)
    .eq('period_month', periodMonth)

  if (error) {
    throw new Error(`getSavingsBudgetVsActualByPeriod failed: ${error.message}`)
  }

  return (data ?? []) as SavingsBudgetVsActualSourceRow[]
}
