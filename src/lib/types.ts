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
  icon_name: string | null
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

export interface CategoryBudgetSummary {
  category: Category
  budget_amount: number
  spent_amount: number
  remaining: number
  percentage: number
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
      transactions: TableDef<Transaction, Omit<Transaction, 'id' | 'created_at' | 'updated_at'>, Partial<Transaction>>
      income_sources: TableDef<IncomeSource, Omit<IncomeSource, 'id' | 'created_at' | 'updated_at'>, Partial<IncomeSource>>
      recurring_obligations: TableDef<RecurringObligation, Omit<RecurringObligation, 'id' | 'created_at' | 'updated_at'>, Partial<RecurringObligation>>
    }
    Views: Record<string, never>
    Functions: Record<string, never>
  }
}
