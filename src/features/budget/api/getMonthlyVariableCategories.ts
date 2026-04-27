import { supabaseBudget } from '@/lib/supabaseBudget'
import type { AnalyticsMonthlyCategoryMetrics } from '@/lib/types'

const MONTHLY_VARIABLE_CATEGORIES_COLUMNS = [
  'month_start',
  'period_year',
  'period_month',
  'category_id',
  'category_name',
  'parent_category_id',
  'parent_category_name',
  'category_path',
  'amount_total',
].join(', ')

export async function getMonthlyVariableCategories(year?: number): Promise<AnalyticsMonthlyCategoryMetrics[]> {
  let query = supabaseBudget
    .from('analytics_monthly_category_metrics')
    .select(MONTHLY_VARIABLE_CATEGORIES_COLUMNS)
    .eq('flow_type', 'expense')
    .eq('budget_behavior', 'variable')
    .order('month_start', { ascending: true })
    .order('amount_total', { ascending: false })

  if (typeof year === 'number') {
    query = query.eq('period_year', year)
  }

  const { data, error } = await query

  if (error) {
    throw new Error(`getMonthlyVariableCategories failed: ${error.message}`)
  }

  return (data ?? []) as unknown as AnalyticsMonthlyCategoryMetrics[]
}
