export type HomeBudgetBucketId =
  | 'socle_fixe'
  | 'variable_essentielle'
  | 'discretionnaire'
  | 'provision'
  | 'epargne'

export interface HomeBudgetBucket {
  budget_bucket: HomeBudgetBucketId
  budget_amount: number
  actual_amount: number
  remaining_amount: number
  variance_amount: number
  variance_pct: number | null
  transaction_count: number
}

export interface HomeBudgetCategory {
  category_id: string
  category_name: string
  parent_category_id: string | null
  parent_category_name: string | null
  budget_bucket: HomeBudgetBucketId
  budget_amount: number
  actual_amount: number
  remaining_amount: number
  variance_amount: number
  variance_pct: number | null
}

export interface PlannedOperationItem {
  id?: string
  label?: string
  amount?: number
  scheduled_date?: string
  [key: string]: unknown
}

export interface HomeDailyBudgetPayload {
  period: {
    today: string
    month_start: string
    month_end: string
    period_year: number
    period_month: number
    days_remaining: number
  }
  account: {
    main_account_id: string
    main_account_name: string
    main_account_balance: number | null
  }
  budgets: {
    fixed_budget_amount: number
    variable_essential_budget_amount: number
    discretionary_budget_amount: number
    provision_budget_amount: number
    savings_budget_amount: number
  }
  realized: {
    revenue_amount: number
    savings_actual_amount: number
    provision_actual_amount: number
    total_transaction_count: number
    pilotage_operation_amount: number
    consumption_expense_amount: number
    out_of_pilotage_raw_amount: number
    pilotage_transaction_count: number
    total_raw_operation_amount: number
  }
  daily_pilotage: {
    revenue_amount: number
    committed_amount: number
    remaining_useful_amount: number
    budget_per_remaining_day: number
  }
  planned_operations: {
    count: number
    total_amount: number
    items: PlannedOperationItem[]
  }
  by_bucket: HomeBudgetBucket[]
  by_category: HomeBudgetCategory[]
}
