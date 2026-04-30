import { budgetDb } from '@/lib/supabaseBudget'
import type { StatsPeriodRow } from '@/features/stats/types'

const PERIOD_COLUMNS = ['id', 'period_year', 'period_month', 'label'].join(', ')

export async function getLatestBudgetPeriod(): Promise<StatsPeriodRow | null> {
  const { data, error } = await budgetDb()
    .from('budget_periods')
    .select(PERIOD_COLUMNS)
    .order('period_year', { ascending: false })
    .order('period_month', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) {
    throw new Error(`getLatestBudgetPeriod (stats) failed: ${error.message}`)
  }

  return (data ?? null) as StatsPeriodRow | null
}
