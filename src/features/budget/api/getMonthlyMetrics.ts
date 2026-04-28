import { budgetDb } from '@/lib/supabaseBudget'
import type { AnalyticsMonthlyMetrics } from '@/lib/types'

const MONTHLY_METRICS_COLUMNS = [
  'month_start',
  'period_year',
  'period_month',
  'variable_expense_total',
  'fixed_expense_total',
  'expense_total',
  'income_total',
  'savings_capacity_observed',
  'refreshed_at',
].join(', ')

export async function getMonthlyMetrics(year?: number): Promise<AnalyticsMonthlyMetrics[]> {
  let query = budgetDb()
    .from('analytics_monthly_metrics')
    .select(MONTHLY_METRICS_COLUMNS)
    .order('month_start', { ascending: true })

  if (typeof year === 'number') {
    query = query.eq('period_year', year)
  }

  const { data, error } = await query

  if (error) {
    throw new Error(`getMonthlyMetrics failed: ${error.message}`)
  }

  return (data ?? []) as unknown as AnalyticsMonthlyMetrics[]
}
