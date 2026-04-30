import { budgetDb } from '@/lib/supabaseBudget'
import type { BudgetPeriodOption } from '@/features/budget/types'

const PERIOD_COLUMNS = ['id', 'period_year', 'period_month', 'label', 'starts_on', 'ends_on'].join(', ')

export async function getLatestBudgetPeriod(): Promise<BudgetPeriodOption | null> {
  const { data, error } = await budgetDb()
    .from('budget_periods')
    .select(PERIOD_COLUMNS)
    .order('period_year', { ascending: false })
    .order('period_month', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) {
    throw new Error(`getLatestBudgetPeriod failed: ${error.message}`)
  }

  return (data ?? null) as BudgetPeriodOption | null
}
