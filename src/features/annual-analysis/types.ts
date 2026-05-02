export interface Annual2025InsightRow {
  insight_key: string
  insight_level: 'info' | 'success' | 'warning' | 'alert'
  value_text: string | null
  value_numeric: number | null
  payload: Record<string, unknown> | unknown[]
}

export interface AnnualTotalsPayload {
  expense_total_year: number
  income_total_year: number
  savings_total_year: number
  net_cashflow_year: number
  avg_monthly_expense: number
}

export interface Annual2025YearlyBucketRow {
  analysis_year: number
  budget_bucket: string
  amount_total_year: number
  share_of_year_expense_pct: number | null
  rank_in_year: number | null
  tx_count_year?: number | null
  avg_ticket_year?: number | null
  active_months_count?: number | null
  avg_monthly_amount_12m?: number | null
  median_monthly_amount_12m?: number | null
  peak_month?: number | null
  low_month?: number | null
}

export interface Annual2025YearlyCategoryRow {
  category_name: string
  category_level: 'parent' | 'leaf'
  amount_total_year: number
  share_of_year_expense_pct: number
  rank_in_year: number
  analysis_year: number
}

export interface Annual2025MonthlySummaryRow {
  period_month: number
  period_year: number
  expense_total: number
  income_total: number
  savings_capacity: number
  net_cashflow: number
}

export interface MonthlyProfilePoint {
  period_month: number
  month_label: string
  expense_total: number
  income_total: number
  savings_capacity: number
  net_cashflow: number
}

export interface Top5CategoryItem {
  rank: number
  category_name: string
  parent_category_name?: string | null
  amount: number
  pct: number
}

export interface Annual2025Analysis {
  loading: boolean
  error: string | null
  annualTotals: AnnualTotalsPayload | null
  insightByKey: Record<string, Annual2025InsightRow>
  yearlyBuckets: Annual2025YearlyBucketRow[]
  yearlyParentCategories: Annual2025YearlyCategoryRow[]
  monthlyProfile: MonthlyProfilePoint[]
  top5ParentCategories: Top5CategoryItem[]
  top5LeafCategories: Top5CategoryItem[]
}
