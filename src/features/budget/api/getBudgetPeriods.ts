import { budgetDb } from '@/lib/supabaseBudget'
import type { BudgetPeriodOption } from '@/features/budget/types'

const PERIOD_COLUMNS = ['id', 'period_year', 'period_month', 'label', 'starts_on', 'ends_on'].join(', ')

export async function getBudgetPeriods(): Promise<BudgetPeriodOption[]> {
  const { data, error } = await budgetDb()
    .from('budget_periods')
    .select(PERIOD_COLUMNS)
    .order('period_year', { ascending: false })
    .order('period_month', { ascending: false })

  if (error) {
    throw new Error(`getBudgetPeriods failed: ${error.message}`)
  }

  return (data ?? []) as unknown as BudgetPeriodOption[]
}
