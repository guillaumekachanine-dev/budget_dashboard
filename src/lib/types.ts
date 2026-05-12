export type AccountType = 'checking' | 'savings' | 'credit_card' | 'cash' | 'other'
export type FlowType = 'income' | 'expense' | 'transfer' | 'savings'
export type Direction = 'income' | 'expense' | 'transfer_in' | 'transfer_out' | 'savings'
export type BudgetBehavior = 'fixed' | 'variable' | 'excluded'
export type BudgetKind = 'global_variable' | 'category'
export type IncomeType = 'salary' | 'freelance' | 'benefit' | 'refund' | 'bonus' | 'other'
export type RecurrenceFrequency = 'monthly' | 'quarterly' | 'yearly'
export type PlannedOperationFlowType = 'expense' | 'income' | 'savings' | 'transfer'
export type PlannedOperationBudgetImpact = 'already_budgeted' | 'additional_commitment' | 'informational'
export type PlannedOperationStatus = 'planned' | 'paid' | 'cancelled' | 'skipped' | 'matched'
export type PlannedOperationRecurrenceFrequency = 'none' | 'monthly' | 'quarterly' | 'yearly'

export interface Account {
  id: string
  user_id: string
  name: string
  account_type: AccountType
  institution_name: string | null
  currency: string
  is_liquid: boolean
  include_in_dashboard: boolean
  opening_balance: number | null
  notes: string | null
  created_at: string
  updated_at: string
}

export interface Category {
  id: string
  user_id: string
  name: string
  parent_id: string | null
  flow_type: FlowType
  budget_behavior: BudgetBehavior
  is_active: boolean
  sort_order: number
  icon_key: string | null
  icon_name?: string | null
  color_token: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

export interface BudgetPeriod {
  id: string
  user_id: string
  period_year: number
  period_month: number
  starts_on: string
  ends_on: string
  label: string
  created_at: string
  updated_at: string
}

export interface Budget {
  id: string
  user_id: string
  period_id: string
  category_id: string | null
  budget_kind: BudgetKind
  amount: number
  currency: string
  notes: string | null
  created_at: string
  updated_at: string
  category?: Category
  period?: BudgetPeriod
}

export interface BudgetRecommendation {
  id: string
  user_id: string
  analysis_start_month: string
  analysis_end_exclusive: string
  target_period_year: number | null
  target_period_month: number | null
  category_id: string
  category_name: string
  parent_category_id: string | null
  parent_category_name: string | null
  category_path: string
  category_budget_behavior: string | null
  months_observed: number
  active_months_count: number
  activity_ratio: number | null
  total_amount: number
  avg_full_monthly_amount: number | null
  avg_active_monthly_amount: number | null
  median_full_monthly_amount: number | null
  median_active_monthly_amount: number | null
  min_active_monthly_amount: number | null
  max_monthly_amount: number | null
  avg_last_3_full_months: number | null
  avg_last_3_nonzero_months: number | null
  budget_method: string
  budget_bucket: string
  raw_budget_monthly_eur: number
  proposed_budget_monthly_eur: number
  formula_applied: string | null
  needs_manual_review: boolean
  recommendation_comment: string | null
  manual_budget_monthly_eur: number | null
  final_budget_monthly_eur: number | null
  decision_status: string
  decision_notes: string | null
  applied_period_id: string | null
  applied_to_budgets_at: string | null
  created_at: string
  updated_at: string
}

export interface Transaction {
  id: string
  user_id: string
  account_id: string
  category_id: string | null
  income_source_id: string | null
  import_batch_id: string | null
  staging_row_id: string | null
  transaction_date: string
  amount: number
  currency: string
  personal_share_ratio?: number | null
  direction: Direction
  flow_type: FlowType
  budget_behavior: BudgetBehavior
  raw_label: string | null
  normalized_label: string | null
  merchant_name: string | null
  external_id: string | null
  is_recurring: boolean
  is_verified: boolean
  is_hidden: boolean
  personal_scope?: string | null
  notes: string | null
  meta: Record<string, unknown> | null
  created_at: string
  updated_at: string
  category?: Category
  account?: Account
}

export interface IncomeSource {
  id: string
  user_id: string
  name: string
  income_type: IncomeType
  is_recurring: boolean
  expected_amount: number | null
  currency: string
  day_of_month: number | null
  is_active: boolean
  notes: string | null
  created_at: string
  updated_at: string
}

export interface RecurringObligation {
  id: string
  user_id: string
  label: string
  category_id: string | null
  account_id: string | null
  amount: number
  currency: string
  due_day: number
  recurrence_frequency: RecurrenceFrequency
  starts_on: string | null
  ends_on: string | null
  is_active: boolean
  notes: string | null
  created_at: string
  updated_at: string
}

export interface PlannedOperation {
  id: string
  user_id: string
  account_id: string | null
  category_id: string | null
  merchant_name: string | null
  label: string
  planned_date: string
  planned_amount: number
  currency: 'EUR'
  flow_type: PlannedOperationFlowType
  status: PlannedOperationStatus
  budget_impact: PlannedOperationBudgetImpact
  personal_share_ratio: number
  notes: string | null
  matched_transaction_id: string | null
  is_recurring: boolean
  recurrence_frequency: PlannedOperationRecurrenceFrequency
  recurrence_day_of_month: number | null
  recurrence_start_date: string | null
  recurrence_end_date: string | null
  source_key: string | null
  category?: Pick<Category, 'id' | 'name' | 'icon_key'> | null
  created_at: string
  updated_at: string
}

export type PlannedOperationFlowItem = {
  id: string
  source_planned_operation_id: string
  account_id: string | null
  category_id: string | null
  label: string | null
  original_planned_date: string | null
  original_month_start: string | null
  planned_date: string
  month_start: string
  planned_amount: number
  personal_share_ratio: number | null
  planned_personal_amount: number
  currency: string | null
  flow_type: PlannedOperationFlowType | null
  status: string | null
  budget_impact: string | null
  category_name: string | null
  parent_category_name: string | null
  budget_bucket: string | null
  impacts_remaining_useful: boolean | null
  remaining_useful_impact_amount: number | null
  matched_transaction_id: string | null
  notes: string | null
  is_generated_occurrence: boolean
  created_at: string | null
  updated_at: string | null
  source: 'planned_operation'
  planned_status: 'done' | 'upcoming'
}

export type PlannedOperationInsert = {
  user_id: string
  account_id?: string | null
  category_id?: string | null
  merchant_name?: string | null
  label: string
  planned_date: string
  planned_amount: number
  currency: 'EUR'
  flow_type: PlannedOperationFlowType
  status: 'planned'
  budget_impact: PlannedOperationBudgetImpact
  personal_share_ratio: number
  matched_transaction_id: null
  notes?: string | null
  is_recurring: boolean
  recurrence_frequency: PlannedOperationRecurrenceFrequency
  recurrence_day_of_month: number | null
  recurrence_start_date: string | null
  recurrence_end_date: string | null
}

export interface PlannedOperationsEnrichedViewRow {
  id: string | null
  user_id: string | null
  source_planned_operation_id: string | null
  account_id: string | null
  category_id: string | null
  label: string | null
  original_planned_date: string | null
  original_month_start: string | null
  planned_date: string | null
  month_start: string | null
  planned_amount: number | null
  personal_share_ratio: number | null
  planned_personal_amount: number | null
  currency: string | null
  flow_type: PlannedOperationFlowType | null
  status: string | null
  budget_impact: string | null
  category_name: string | null
  parent_category_name: string | null
  budget_bucket: string | null
  impacts_remaining_useful: boolean | null
  remaining_useful_impact_amount: number | null
  matched_transaction_id: string | null
  notes: string | null
  planned_status: 'done' | 'upcoming' | null
  is_generated_occurrence: boolean | null
  created_at: string | null
  updated_at: string | null
}

export interface AccountWithBalance extends Account {
  current_balance: number
}

export interface AccountBalanceRow {
  id: string
  account_id: string
  balance_amount: number
  currency: string
  created_at: string
  updated_at: string
}

export interface CategoryBudgetSummary {
  category: Category
  budget_amount: number
  spent_amount: number
  remaining: number
  percentage: number
}

export interface AnalyticsMonthlyMetrics {
  month_start: string
  period_year: number
  period_month: number
  variable_expense_total: number
  fixed_expense_total: number
  expense_total: number
  income_total: number
  savings_capacity_observed: number
  refreshed_at: string
}

export interface AnalyticsMonthlyCategoryMetrics {
  month_start: string
  period_year: number
  period_month: number
  category_id: string
  category_name: string
  parent_category_id: string | null
  parent_category_name: string | null
  category_path: string
  flow_type: FlowType
  budget_behavior: BudgetBehavior
  amount_total: number
  refreshed_at: string
}

export interface AnalyticsVariableCategorySummary {
  category_id: string
  category_name: string
  parent_category_id: string | null
  parent_category_name: string | null
  category_path: string
  active_months_count: number
  avg_monthly_amount: number
  median_monthly_amount: number
  min_monthly_amount: number
  max_monthly_amount: number
  total_amount: number
  refreshed_at: string
}

export interface BudgetBucketTotalsByPeriodRow {
  user_id: string | null
  period_id: string | null
  period_year: number | null
  period_month: number | null
  budget_bucket: string | null
  total_budget_bucket_eur: number | null
}

export interface BudgetBucketBudgetVsActualByMonthRow {
  user_id: string | null
  month_start: string | null
  period_year: number | null
  period_month: number | null
  budget_bucket: string | null
  target_budget_bucket_eur: number | null
  actual_budget_bucket_eur: number | null
  delta_budget_bucket_eur: number | null
  consumption_ratio: number | null
}

export interface ExpenseBudgetLineRow {
  user_id: string | null
  category_name: string | null
  parent_category_name: string | null
  amount: number | null
  effective_bucket: string | null
  method: string | null
}

export interface SavingsBudgetTotalsByPeriodRow {
  user_id: string | null
  period_id: string | null
  period_year: number | null
  period_month: number | null
  total_savings_budget_eur: number | null
}

export interface SavingsBudgetLinesByPeriodRow {
  user_id: string | null
  period_id: string | null
  period_year: number | null
  period_month: number | null
  category_id: string | null
  category_name: string | null
  parent_category_name: string | null
  amount: number | null
  notes: string | null
}

export interface SavingsBudgetVsActualByPeriodRow {
  user_id: string | null
  period_id: string | null
  period_year: number | null
  period_month: number | null
  category_id: string | null
  category_name: string | null
  parent_category_name: string | null
  target_savings_amount_eur: number | null
  actual_savings_amount_eur: number | null
  delta_savings_amount_eur: number | null
}

export interface SavingsCurrentSummaryRow {
  user_id: string | null
  total_savings: number | null
  livrets_total: number | null
  placements_total: number | null
  liquid_savings_total: number | null
  locked_savings_total: number | null
  accounts_count: number | null
  livrets_share_pct: number | null
  placements_share_pct: number | null
  liquid_share_pct: number | null
  locked_share_pct: number | null
}

export interface SavingsMonthlyMetricsRow {
  month_start: string | null
  period_year: number | null
  period_month: number | null
  saved_amount: number | null
  transfer_count: number | null
  destination_count: number | null
  income_total: number | null
  savings_rate_on_income_pct: number | null
  savings_budget_total: number | null
  global_budget_total: number | null
  savings_share_of_budget_pct: number | null
  savings_rolling_avg_3m: number | null
  savings_rolling_avg_6m: number | null
  annualized_savings_speed_3m: number | null
  ytd_saved_amount: number | null
}

export interface SavingsDestinationBreakdownViewRow {
  month_start: string | null
  period_year: number | null
  period_month: number | null
  destination_family: string | null
  destination_label: string | null
  saved_amount: number | null
  transfer_count: number | null
  avg_transfer_amount: number | null
}

export interface MonthlyBucketActualsCleanRow {
  user_id: string | null
  month_start: string | null
  budget_bucket: string | null
  transaction_count: number | null
  revenue_amount: number | null
  net_amount: number | null
}

export interface CategoryAnnualCostProjection2026Row {
  category_id: string | null
  category_name: string | null
  parent_category_name: string | null
  budget_bucket: string | null
  months_elapsed: number | null
  remaining_months: number | null
  actual_ytd_amount: number | null
  avg_monthly_ytd_amount: number | null
  projected_remaining_amount: number | null
  projected_annual_amount: number | null
  budget_ytd_amount: number | null
  budget_annual_amount: number | null
  projected_vs_budget_amount: number | null
  projected_vs_budget_pct: number | null
}

export interface AnnualProjectionOverview2026Row {
  months_elapsed: number | null
  remaining_months: number | null
  projected_core_expenses_amount: number | null
  projected_flexible_expenses_amount: number | null
  projected_total_expenses_amount: number | null
  projected_revenue_amount: number | null
  projected_savings_amount: number | null
  projected_revenue_after_savings_amount: number | null
  projected_expenses_to_revenue_pct: number | null
  projected_savings_to_revenue_pct: number | null
}

export interface BudgetTransactionsEnrichedRow {
  id: string | null
  user_id: string | null
  account_id: string | null
  transaction_date: string | null
  amount: number | null
  pilotage_amount: number | null
  normalized_label: string | null
  raw_label: string | null
  mapped_category_name: string | null
  mapped_parent_category_name: string | null
  mapped_budget_bucket: string | null
}

type TableDef<Row, Insert, Update = Partial<Insert>> = {
  Row: Row & Record<string, unknown>
  Insert: Insert & Record<string, unknown>
  Update: Update & Record<string, unknown>
  Relationships: []
}

export type Database = {
  budget_dashboard: {
    Tables: {
      accounts: TableDef<Account, Omit<Account, 'id' | 'created_at' | 'updated_at'>, Partial<Account>>
      categories: TableDef<Category, Omit<Category, 'id' | 'created_at' | 'updated_at'>, Partial<Category>>
      budget_periods: TableDef<BudgetPeriod, Omit<BudgetPeriod, 'id' | 'created_at' | 'updated_at'>, Partial<BudgetPeriod>>
      budgets: TableDef<Budget, Omit<Budget, 'id' | 'created_at' | 'updated_at'>, Partial<Budget>>
      budget_recommendations: TableDef<BudgetRecommendation, Omit<BudgetRecommendation, 'id' | 'created_at' | 'updated_at'>, Partial<BudgetRecommendation>>
      transactions: TableDef<Transaction, Omit<Transaction, 'id' | 'created_at' | 'updated_at'>, Partial<Transaction>>
      planned_operations: TableDef<PlannedOperation, PlannedOperationInsert, Partial<PlannedOperation>>
      income_sources: TableDef<IncomeSource, Omit<IncomeSource, 'id' | 'created_at' | 'updated_at'>, Partial<IncomeSource>>
      recurring_obligations: TableDef<RecurringObligation, Omit<RecurringObligation, 'id' | 'created_at' | 'updated_at'>, Partial<RecurringObligation>>
      analytics_monthly_metrics: TableDef<AnalyticsMonthlyMetrics, Omit<AnalyticsMonthlyMetrics, never>, Partial<AnalyticsMonthlyMetrics>>
      analytics_monthly_category_metrics: TableDef<AnalyticsMonthlyCategoryMetrics, Omit<AnalyticsMonthlyCategoryMetrics, never>, Partial<AnalyticsMonthlyCategoryMetrics>>
      analytics_variable_category_summary: TableDef<AnalyticsVariableCategorySummary, Omit<AnalyticsVariableCategorySummary, never>, Partial<AnalyticsVariableCategorySummary>>
      analytics_2025_insights: TableDef<Record<string, unknown>, Record<string, unknown>, Partial<Record<string, unknown>>>
      analytics_2025_monthly_bucket_summary: TableDef<Record<string, unknown>, Record<string, unknown>, Partial<Record<string, unknown>>>
      analytics_2025_monthly_category_summary: TableDef<Record<string, unknown>, Record<string, unknown>, Partial<Record<string, unknown>>>
      analytics_2025_monthly_summary: TableDef<Record<string, unknown>, Record<string, unknown>, Partial<Record<string, unknown>>>
      analytics_2025_spending_periodicity: TableDef<Record<string, unknown>, Record<string, unknown>, Partial<Record<string, unknown>>>
      analytics_2025_yearly_bucket_summary: TableDef<Record<string, unknown>, Record<string, unknown>, Partial<Record<string, unknown>>>
      analytics_2025_yearly_category_summary: TableDef<Record<string, unknown>, Record<string, unknown>, Partial<Record<string, unknown>>>
      analytics_2025_yearly_summary: TableDef<Record<string, unknown>, Record<string, unknown>, Partial<Record<string, unknown>>>
      accounts_balance: TableDef<AccountBalanceRow, Omit<AccountBalanceRow, 'id' | 'created_at' | 'updated_at'>, Partial<AccountBalanceRow>>
      category_budget_bucket_map: TableDef<Record<string, unknown>, Record<string, unknown>, Partial<Record<string, unknown>>>
      import_batches: TableDef<Record<string, unknown>, Record<string, unknown>, Partial<Record<string, unknown>>>
      transactions_staging: TableDef<Record<string, unknown>, Record<string, unknown>, Partial<Record<string, unknown>>>
    }
    Views: {
      budget_bucket_totals_by_period: { Row: BudgetBucketTotalsByPeriodRow & Record<string, unknown>; Relationships: [] }
      budget_bucket_budget_vs_actual_by_month: { Row: BudgetBucketBudgetVsActualByMonthRow & Record<string, unknown>; Relationships: [] }
      expense_budget_lines: { Row: ExpenseBudgetLineRow & Record<string, unknown>; Relationships: [] }
      savings_budget_totals_by_period: { Row: SavingsBudgetTotalsByPeriodRow & Record<string, unknown>; Relationships: [] }
      savings_budget_lines_by_period: { Row: SavingsBudgetLinesByPeriodRow & Record<string, unknown>; Relationships: [] }
      savings_budget_vs_actual_by_period: { Row: SavingsBudgetVsActualByPeriodRow & Record<string, unknown>; Relationships: [] }
      v_savings_current_summary: { Row: SavingsCurrentSummaryRow & Record<string, unknown>; Relationships: [] }
      v_savings_monthly_metrics: { Row: SavingsMonthlyMetricsRow & Record<string, unknown>; Relationships: [] }
      v_savings_destination_breakdown: { Row: SavingsDestinationBreakdownViewRow & Record<string, unknown>; Relationships: [] }
      v_monthly_bucket_actuals_clean: { Row: MonthlyBucketActualsCleanRow & Record<string, unknown>; Relationships: [] }
      v_category_annual_cost_projection_2026: { Row: CategoryAnnualCostProjection2026Row & Record<string, unknown>; Relationships: [] }
      v_annual_projection_overview_2026: { Row: AnnualProjectionOverview2026Row & Record<string, unknown>; Relationships: [] }
      v_budget_transactions_enriched: { Row: BudgetTransactionsEnrichedRow & Record<string, unknown>; Relationships: [] }
      v_planned_operations_enriched: { Row: PlannedOperationsEnrichedViewRow & Record<string, unknown>; Relationships: [] }
      v_planned_operations_occurrences_enriched: { Row: PlannedOperationsEnrichedViewRow & Record<string, unknown>; Relationships: [] }
      account_balances: { Row: { account_id: string; current_balance: number }; Relationships: [] }
    }
    Functions: {
      get_budget_page_payload: {
        Args: {
          p_user_id: string
          p_period_year: number
          p_period_month: number
          p_months_back?: number
        }
        Returns: Record<string, unknown>
      }
      get_home_daily_budget_payload: {
        Args: {
          p_user_id: string
          p_period_year: number
          p_period_month: number
        }
        Returns: Record<string, unknown>
      }
      get_financial_security_payload: {
        Args: Record<string, never>
        Returns: Record<string, unknown>
      }
      get_optimization_capacity_payload: {
        Args: { p_year: number }
        Returns: Record<string, unknown>
      }
      get_investment_performance_payload: {
        Args: { p_year: number }
        Returns: Record<string, unknown>
      }
      refresh_budget_analytics: {
        Args: { p_user_id: string }
        Returns: null
      }
    }
  }
}
