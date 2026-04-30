import { budgetDb } from '@/lib/supabaseBudget'
import type { BudgetRecommendationApplied } from '@/features/budget/types'

const BUDGET_RECOMMENDATION_COLUMNS = [
  'id',
  'applied_period_id',
  'category_id',
  'budget_bucket',
  'budget_method',
  'decision_status',
  'final_budget_monthly_eur',
  'manual_budget_monthly_eur',
  'recommendation_comment',
].join(', ')

export async function getBudgetRecommendationsForAppliedPeriod(periodId: string): Promise<BudgetRecommendationApplied[]> {
  const { data, error } = await budgetDb()
    .from('budget_recommendations')
    .select(BUDGET_RECOMMENDATION_COLUMNS)
    .eq('applied_period_id', periodId)
    .order('category_id', { ascending: true })

  if (error) {
    throw new Error(`getBudgetRecommendationsForAppliedPeriod failed: ${error.message}`)
  }

  const rows = (data ?? []) as unknown as BudgetRecommendationApplied[]

  return rows.map((row) => ({
    ...row,
    final_budget_monthly_eur: row.final_budget_monthly_eur == null ? null : Number(row.final_budget_monthly_eur),
    manual_budget_monthly_eur: row.manual_budget_monthly_eur == null ? null : Number(row.manual_budget_monthly_eur),
  }))
}
