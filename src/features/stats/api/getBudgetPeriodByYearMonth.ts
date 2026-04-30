import { budgetDb } from '@/lib/supabaseBudget'
import type { StatsPeriodRow } from '@/features/stats/types'

const PERIOD_COLUMNS = ['id', 'period_year', 'period_month', 'label'].join(', ')

export async function getBudgetPeriodByYearMonth(periodYear: number, periodMonth: number): Promise<StatsPeriodRow | null> {
  const { data, error } = await budgetDb()
    .from('budget_periods')
    .select(PERIOD_COLUMNS)
    .eq('period_year', periodYear)
    .eq('period_month', periodMonth)
    .limit(1)
    .maybeSingle()

  if (error) {
    throw new Error(`getBudgetPeriodByYearMonth failed: ${error.message}`)
  }

  return (data ?? null) as StatsPeriodRow | null
}
