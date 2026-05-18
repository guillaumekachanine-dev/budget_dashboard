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

export type SavingsRiskLevel = 'low' | 'medium' | 'high'

export type SavingsAccountDisplay = {
  config_id: string
  user_id: string
  account_id: string
  savings_family: string | null
  savings_kind: string | null
  display_name: string | null
  display_order: number | null
  is_liquid: boolean | null
  risk_level: SavingsRiskLevel | null
  is_tax_advantaged: boolean | null
  is_locked: boolean | null
  institution_name: string | null
  currency: string | null
  current_balance: number | null
  sub_accounts_count: number | null
  latest_balance_month: string | null
  latest_observed_date: string | null
}

export type SavingsAnnualPerformanceRow = {
  user_id: string
  account_id: string
  display_name: string | null
  display_order: number | null
  savings_family: string | null
  savings_kind: string | null
  period_year: number | null
  balance_boy: number | null
  balance_eoy: number | null
  total_versed_eur: number | null
  operations_count: number | null
  performance_amount: number | null
  performance_pct: number | null
  regulated_rate_pct: number | null
  regulated_interest_theoretical: number | null
  latest_snapshot_date: string | null
}

export type SavingsPortfolioAnnualRow = {
  user_id: string
  period_year: number | null
  total_portfolio_eoy: number | null
  total_portfolio_boy: number | null
  total_versed_year: number | null
  total_performance_amount: number | null
  livrets_eoy: number | null
  placements_eoy: number | null
  livrets_versed: number | null
  placements_versed: number | null
  livrets_performance: number | null
  placements_performance: number | null
  accounts_count: number | null
  portfolio_performance_pct: number | null
  cumul_versed_all_time: number | null
  cumul_performance_all_time: number | null
}

export type SavingsEvolutionFiveYearsSeries = {
  key: string
  label: string
  color: string
  family: 'livrets' | 'placements'
  savings_kind: string
  risk_level: SavingsRiskLevel | null
}

export type SavingsEvolutionFiveYearsRow = {
  year: string
  [seriesKey: string]: number | string
}

export type SavingsEvolutionYearAccountMetrics = {
  operations_count: number
  total_saved_amount: number
}

export type SavingsEvolutionOperationEvent = {
  id: string
  account_key: string
  account_label: string
  year: string
  transaction_date: string
  amount: number
  nature: 'virement' | 'intérêts'
}

export type SavingsEvolutionFiveYearsPayload = {
  rows: SavingsEvolutionFiveYearsRow[]
  series: SavingsEvolutionFiveYearsSeries[]
  yearly_account_metrics: Record<string, SavingsEvolutionYearAccountMetrics>
  operation_events: SavingsEvolutionOperationEvent[]
  isFallback: boolean
}
