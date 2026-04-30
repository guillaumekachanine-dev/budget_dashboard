import { budgetDb } from '@/lib/supabaseBudget'
import type { SavingsBudgetLineSourceRow } from '@/features/stats/types'

export async function getSavingsBudgetLinesByPeriod(
  periodYear: number,
  periodMonth: number,
): Promise<SavingsBudgetLineSourceRow[]> {
  const { data, error } = await budgetDb()
    .from('savings_budget_lines_by_period')
    .select('*')
    .eq('period_year', periodYear)
    .eq('period_month', periodMonth)

  if (error) {
    throw new Error(`getSavingsBudgetLinesByPeriod failed: ${error.message}`)
  }

  return (data ?? []) as SavingsBudgetLineSourceRow[]
}
