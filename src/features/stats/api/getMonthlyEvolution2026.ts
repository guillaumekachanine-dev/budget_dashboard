import { budgetDb } from '@/lib/supabaseBudget'
import type { MonthlyEvolutionRow } from '@/features/stats/types'

const MONTHLY_EVOLUTION_COLUMNS = [
  'month_start',
  'period_year',
  'period_month',
  'variable_expense_total',
  'fixed_expense_total',
  'expense_total',
  'income_total',
  'savings_capacity_observed',
].join(', ')

export async function getMonthlyEvolution2026(): Promise<MonthlyEvolutionRow[]> {
  const { data, error } = await budgetDb()
    .from('analytics_monthly_metrics')
    .select(MONTHLY_EVOLUTION_COLUMNS)
    .eq('period_year', 2026)
    .order('period_month', { ascending: true })

  if (error) {
    throw new Error(`getMonthlyEvolution2026 failed: ${error.message}`)
  }

  return (data ?? []) as unknown as MonthlyEvolutionRow[]
}
