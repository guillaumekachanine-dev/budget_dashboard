import { budgetDb } from '@/lib/supabaseBudget'
import type { SavingsBudgetTotalsSourceRow } from '@/features/stats/types'

export async function getSavingsBudgetTotalsByPeriod(
  periodYear: number,
  periodMonth: number,
): Promise<SavingsBudgetTotalsSourceRow[]> {
  const { data, error } = await budgetDb()
    .from('savings_budget_totals_by_period')
    .select('*')
    .eq('period_year', periodYear)
    .eq('period_month', periodMonth)

  if (error) {
    throw new Error(`getSavingsBudgetTotalsByPeriod failed: ${error.message}`)
  }

  return (data ?? []) as SavingsBudgetTotalsSourceRow[]
}
