export type AccountType = 'checking' | 'savings' | 'credit_card' | 'cash' | 'other'
export type FlowType = 'income' | 'expense' | 'transfer' | 'savings'
export type Direction = 'income' | 'expense' | 'transfer_in' | 'transfer_out' | 'savings'
export type BudgetBehavior = 'fixed' | 'variable' | 'excluded'
export type BudgetKind = 'global_variable' | 'category'
export type IncomeType = 'salary' | 'freelance' | 'benefit' | 'refund' | 'bonus' | 'other'
export type RecurrenceFrequency = 'monthly' | 'quarterly' | 'yearly'

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
      refresh_budget_analytics: {
        Args: { p_user_id: string }
        Returns: null
      }
    }
  }
}
