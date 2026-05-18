import type { AnalyticsMonthlyMetrics, BudgetPeriod } from '@/lib/types'

export type StatsBudgetBucketKey =
  | 'socle_fixe'
  | 'variable_essentielle'
  | 'provision'
  | 'discretionnaire'
  | 'cagnotte_projet'

export type StatsSelectedPeriod = {
  id: string | null
  period_year: number
  period_month: number
  label: string | null
}

export interface StatsPeriodOption {
  key: string
  id: string | null
  period_year: number
  period_month: number
  label: string
}

export interface StatsMonthlyReference {
  periodYear: number
  periodMonth: number
  label: string
  id: string | null
  budgetSummary: {
    totalExpenseBudget: number
    globalVariableBudget: number
    socleFixeBudget: number
    variableEssentielleBudget: number
    provisionBudget: number
    discretionnaireBudget: number
    cagnotteProjetBudget: number
  }
  budgetBucketVsActual: Array<{
    budgetBucket: string
    targetBudgetBucketEur: number
    actualBudgetBucketEur: number
    deltaBudgetBucketEur: number
    consumptionRatio: number | null
  }>
  savingsSummary: {
    totalSavingsBudget: number
    totalSavingsActual: number
    deltaSavings: number
  }
  savingsLines: Array<{
    categoryName: string
    targetSavingsAmountEur: number
    actualSavingsAmountEur: number
    deltaSavingsAmountEur: number
  }>
  totalMonthlyNeed: number
}

export interface StatsReferenceSnapshot {
  loadedAt: string
  selectedPeriod: StatsSelectedPeriod
  availablePeriodOptions: StatsPeriodOption[]
  monthlyReferences: StatsMonthlyReference[]
  budgetSummary: {
    totalExpenseBudget: number
    globalVariableBudget: number
    socleFixeBudget: number
    variableEssentielleBudget: number
    provisionBudget: number
    discretionnaireBudget: number
    cagnotteProjetBudget: number
  }
  budgetBucketVsActual: Array<{
    budgetBucket: string
    targetBudgetBucketEur: number
    actualBudgetBucketEur: number
    deltaBudgetBucketEur: number
    consumptionRatio: number | null
  }>
  savingsSummary: {
    totalSavingsBudget: number
    totalSavingsActual: number
    deltaSavings: number
  }
  savingsLines: Array<{
    categoryName: string
    targetSavingsAmountEur: number
    actualSavingsAmountEur: number
    deltaSavingsAmountEur: number
  }>
  totalMonthlyNeed: number
  monthlyEvolution2026: Array<{
    monthStart: string
    periodYear: number
    periodMonth: number
    variableExpenseTotal: number
    fixedExpenseTotal: number
    expenseTotal: number
    incomeTotal: number
    savingsCapacityObserved: number
  }>
}

export type StatsPeriodRow = Pick<BudgetPeriod, 'id' | 'period_year' | 'period_month' | 'label'>

export type BudgetBucketTotalSourceRow = Record<string, unknown>
export type BudgetBucketVsActualSourceRow = Record<string, unknown>
export type SavingsBudgetTotalsSourceRow = Record<string, unknown>
export type SavingsBudgetLineSourceRow = Record<string, unknown>
export type SavingsBudgetVsActualSourceRow = Record<string, unknown>

export type MonthlyEvolutionRow = AnalyticsMonthlyMetrics

export type OptimizationCurrentAccountBalance = {
  amount: number | null
  currency: string | null
  as_of_date: string | null
}

export type OptimizationFinancialSecurityReference = {
  security_months_reference: number | null
  liquid_savings_total: number | null
  reference_essential_monthly_spending: number | null
  security_status: string | null
}

export type OptimizationAnnualSummary = {
  gross_savings_capacity_total: number | null
  avg_monthly_gross_savings_capacity: number | null
  planned_savings_total: number | null
  additional_capacity_after_planned_savings_total: number | null
  risk_months_count: number | null
}

export type OptimizationMonthlyForecast = {
  month_start: string | null
  period_year: number | null
  period_month: number | null
  projected_income: number | null
  projected_non_savings_expenses: number | null
  planned_savings_budget: number | null
  gross_savings_capacity: number | null
  additional_capacity_after_planned_savings: number | null
  estimated_current_account_end_balance: number | null
  forecast_status: string | null
}

export type OptimizationLever = {
  category_name: string | null
  parent_category_name: string | null
  budget_bucket: string | null
  avg_monthly_amount_6m: number | null
  realistic_monthly_gain: number | null
  realistic_annual_gain: number | null
  optimization_comment: string | null
}

export type OptimizationScenario = {
  scenario_label: string | null
  monthly_gain: number | null
  projected_gain_on_scope: number | null
  projected_capacity_total: number | null
}

export type OptimizationCapacityPayload = {
  generated_at: string | null
  year: number | null
  current_account_balance: OptimizationCurrentAccountBalance | null
  financial_security_reference: OptimizationFinancialSecurityReference | null
  annual_summary: OptimizationAnnualSummary | null
  monthly_forecast: OptimizationMonthlyForecast[]
  optimization_levers: OptimizationLever[]
  scenarios: OptimizationScenario[]
}

export type InvestmentGlobalSummary = {
  total_invested_value: number | null
  total_investment_cash: number | null
  estimated_gain_vs_known_cash_in: number | null
  estimated_gain_vs_known_cash_in_pct: number | null
  avg_quality_score: number | null
  global_investment_insight: string | null
}

export type InvestmentAccountPerformanceSummary = {
  account_name: string | null
  provider_name: string | null
  product_name: string | null
  envelope_type: string | null
  current_value: number | null
  current_value_source: string | null
  estimated_gain_vs_total_cash_in: number | null
  estimated_gain_vs_total_cash_in_pct: number | null
  global_quality_score: number | null
  quality_status: string | null
  recommended_action: string | null
}

export type InvestmentMonthlyPerformance = {
  month_start: string | null
  period_year: number | null
  period_month: number | null
  total_value: number | null
  total_cash_in: number | null
  total_cash_out: number | null
  net_gain: number | null
  net_gain_pct: number | null
  monthly_return: number | null
  monthly_return_pct: number | null
  quality_score: number | null
}

export type InvestmentCashflow = {
  flow_date: string | null
  account_name: string | null
  flow_type: string | null
  amount: number | null
  description: string | null
}

export type InvestmentActionItem = {
  action_title: string | null
  account_name: string | null
  action_description: string | null
  priority: number | null
  expected_impact_label: string | null
  expected_annual_saving: number | null
  expected_performance_improvement_label: string | null
  status: string | null
}

export type InvestmentPositionSnapshot = {
  asset_name: string | null
  snapshot_date: string | null
  units: number | null
  unit_price: number | null
  market_value: number | null
  cash_value: number | null
  total_value: number | null
  source_document: string | null
}

export type InvestmentPerformancePayload = {
  generated_at: string | null
  year: number | null
  global_summary: InvestmentGlobalSummary | null
  accounts: InvestmentAccountPerformanceSummary[]
  monthly_performance: InvestmentMonthlyPerformance[]
  cashflows: InvestmentCashflow[]
  actions: InvestmentActionItem[]
  latest_positions: InvestmentPositionSnapshot[]
}
