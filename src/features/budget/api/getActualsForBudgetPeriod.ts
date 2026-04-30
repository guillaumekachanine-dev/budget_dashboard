import { budgetDb } from '@/lib/supabaseBudget'
import type { AnalyticsMonthlyMetrics } from '@/lib/types'
import type { BudgetActualCategoryMetric, BudgetActualsForPeriod } from '@/features/budget/types'

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

const CATEGORY_METRICS_COLUMNS = [
  'category_id',
  'category_name',
  'parent_category_id',
  'parent_category_name',
  'amount_total',
].join(', ')

export async function getActualsForBudgetPeriod(year: number, month: number): Promise<BudgetActualsForPeriod> {
  const monthlyMetricsPromise = budgetDb()
    .from('analytics_monthly_metrics')
    .select(MONTHLY_METRICS_COLUMNS)
    .eq('period_year', year)
    .eq('period_month', month)
    .limit(1)
    .maybeSingle()

  const categoryMetricsPromise = budgetDb()
    .from('analytics_monthly_category_metrics')
    .select(CATEGORY_METRICS_COLUMNS)
    .eq('period_year', year)
    .eq('period_month', month)
    .eq('flow_type', 'expense')
    .order('amount_total', { ascending: false })

  const [{ data: monthlyMetricsData, error: monthlyError }, { data: categoryMetricsData, error: categoryError }] = await Promise.all([
    monthlyMetricsPromise,
    categoryMetricsPromise,
  ])

  if (monthlyError) {
    throw new Error(`getActualsForBudgetPeriod failed (monthly metrics): ${monthlyError.message}`)
  }

  if (categoryError) {
    throw new Error(`getActualsForBudgetPeriod failed (category metrics): ${categoryError.message}`)
  }

  const monthlyMetrics = (monthlyMetricsData ?? null) as AnalyticsMonthlyMetrics | null
  const categoryRows = (categoryMetricsData ?? []) as unknown as Array<{
    category_id: string | null
    category_name: string | null
    parent_category_id: string | null
    parent_category_name: string | null
    amount_total: number
  }>

  const categoryActuals = categoryRows.map((row) => ({
    category_id: row.category_id,
    category_name: row.category_name,
    parent_category_id: row.parent_category_id,
    parent_category_name: row.parent_category_name,
    amount_total: Number(row.amount_total ?? 0),
  })) as BudgetActualCategoryMetric[]

  const categoryTotal = categoryActuals.reduce((sum, row) => sum + row.amount_total, 0)

  return {
    monthlyMetrics,
    categoryActuals,
    totalActualExpense: monthlyMetrics ? Number(monthlyMetrics.expense_total ?? 0) : categoryTotal,
  }
}
