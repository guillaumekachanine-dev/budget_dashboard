export type SavingsCurrentSummary = {
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

export type SavingsMonthlyMetric = {
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

export type SavingsDestinationBreakdownRow = {
  month_start: string | null
  period_year: number | null
  period_month: number | null
  destination_family: string | null
  destination_label: string | null
  saved_amount: number | null
  transfer_count: number | null
  avg_transfer_amount: number | null
}

export type SavingsAnalyticsData = {
  monthlyMetrics: SavingsMonthlyMetric[]
  destinationBreakdown: SavingsDestinationBreakdownRow[]
  currentSummary: SavingsCurrentSummary | null
}

export type FinancialSecurityStatus =
  | 'critical'
  | 'building'
  | 'comfortable'
  | 'premium_reached'
  | 'insufficient_data'

export type FinancialSecuritySummary = {
  total_savings: number | null
  livrets_total: number | null
  placements_total: number | null
  liquid_savings_total: number | null
  locked_savings_total: number | null
  reference_essential_monthly_spending: number | null
  essential_avg_3m: number | null
  essential_avg_6m: number | null
  essential_avg_12m: number | null
  latest_completed_month_essential_spending: number | null
  previous_completed_month_essential_spending: number | null
  latest_essential_spending_change_pct: number | null
  minimum_target_amount: number | null
  comfort_target_amount: number | null
  premium_target_amount: number | null
  security_months_3m_basis: number | null
  security_months_6m_basis: number | null
  security_months_12m_basis: number | null
  security_months_reference: number | null
  comfort_target_surplus_or_gap: number | null
  premium_target_surplus_or_gap: number | null
  security_status: FinancialSecurityStatus | string | null
  security_insight: string | null
  allocation_signal: string | null
  monthly_effort_to_premium_target_in_6m: number | null
  monthly_effort_to_premium_target_in_12m: number | null
}

export type FinancialSecurityMonthlyEssential = {
  month_start: string | null
  period_year: number | null
  period_month: number | null
  socle_fixe_amount: number | null
  variable_essentielle_amount: number | null
  essential_spending_total: number | null
  transaction_count: number | null
}

export type FinancialSecurityPayload = {
  generated_at: string | null
  summary: FinancialSecuritySummary | null
  monthly_essentials: FinancialSecurityMonthlyEssential[]
}
