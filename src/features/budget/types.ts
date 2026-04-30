import type { AnalyticsMonthlyMetrics, BudgetKind, BudgetPeriod } from '@/lib/types'

export type BudgetPeriodOption = Pick<BudgetPeriod, 'id' | 'period_year' | 'period_month' | 'label' | 'starts_on' | 'ends_on'>

export interface BudgetRecommendationApplied {
  id: string
  applied_period_id: string
  category_id: string | null
  budget_bucket: string | null
  budget_method: string | null
  decision_status: string | null
  final_budget_monthly_eur: number | null
  manual_budget_monthly_eur: number | null
  recommendation_comment: string | null
}

export interface BudgetLineWithCategory {
  id: string
  period_id: string
  category_id: string | null
  budget_kind: BudgetKind
  amount: number
  currency: string
  notes: string | null
  category_name: string | null
  parent_category_id: string | null
  parent_category_name: string | null
  budget_bucket: string | null
  budget_method: string | null
  decision_status: string | null
  final_budget_monthly_eur: number | null
  manual_budget_monthly_eur: number | null
  recommendation_comment: string | null
}

export interface GlobalVariableBudgetLine {
  id: string
  period_id: string
  budget_kind: 'global_variable'
  amount: number
  currency: string
  notes: string | null
}

export interface BudgetLinesForPeriodResult {
  periodId: string
  categoryLines: BudgetLineWithCategory[]
  globalVariableLine: GlobalVariableBudgetLine | null
}

export interface BudgetActualCategoryMetric {
  category_id: string | null
  category_name: string | null
  parent_category_id: string | null
  parent_category_name: string | null
  amount_total: number
}

export interface BudgetActualsForPeriod {
  monthlyMetrics: AnalyticsMonthlyMetrics | null
  categoryActuals: BudgetActualCategoryMetric[]
  totalActualExpense: number
}

export interface BudgetSummary {
  totalBudgetMonthly: number
  globalVariableBudget: number
  socleFixeBudget: number
  variableEssentielleBudget: number
  provisionBudget: number
  discretionnaireBudget: number
  cagnotteProjetBudget: number
  horsPilotageBudget: number
}

export interface BudgetParentGroup {
  parentCategoryId: string
  parentCategoryName: string
  totalAmount: number
  lines: BudgetLineWithCategory[]
}

export interface BudgetVsActualRow {
  id: string
  name: string
  budgetAmount: number
  actualAmount: number
  varianceAmount: number
  consumptionRatio: number
}

export interface BudgetPageSelectedPeriod {
  period_year: number
  period_month: number
  label: string
}

export interface BudgetPageSummary {
  actual_total_to_date: number
  budget_total_reference: number
  variance_amount: number
  variance_pct: number | null
  avg_actual_last_6m: number
  avg_budget_last_6m: number
  avg_variance_pct_last_6m: number | null
}

export interface BudgetPageBucketRow {
  budget_bucket: string
  actual_amount: number
  budget_amount: number
  variance_amount: number
  variance_pct: number | null
  share_actual_pct: number | null
  share_budget_pct: number | null
  avg_actual_last_6m: number
  avg_budget_last_6m: number
  avg_variance_pct_last_6m: number | null
}

export interface BudgetPageParentCategoryRow {
  parent_category_id: string
  parent_category_name: string
  actual_amount: number
  budget_amount: number
  variance_amount: number
  variance_pct: number | null
  share_actual_pct: number | null
  share_budget_pct: number | null
  avg_actual_last_6m: number
  avg_budget_last_6m: number
  avg_variance_pct_last_6m: number | null
}

export interface BudgetPageCategoryRow {
  category_id: string
  category_name: string
  parent_category_id: string | null
  parent_category_name: string | null
  budget_bucket: string
  actual_amount: number
  budget_amount: number
  variance_amount: number
  variance_pct: number | null
  share_actual_pct: number | null
  share_budget_pct: number | null
  avg_actual_last_6m: number
  avg_budget_last_6m: number
  avg_variance_pct_last_6m: number | null
}

export interface BudgetPageHistoryRow {
  period_year: number
  period_month: number
  actual_total: number
  budget_total: number
  variance_amount: number
  variance_pct: number | null
}

export interface BudgetPagePayload {
  selected_period: BudgetPageSelectedPeriod
  summary: BudgetPageSummary
  by_bucket: BudgetPageBucketRow[]
  by_parent_category: BudgetPageParentCategoryRow[]
  by_category: BudgetPageCategoryRow[]
  history_last_6m: BudgetPageHistoryRow[]
}
