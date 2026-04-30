import type { AnalyticsMonthlyMetrics, BudgetPeriod } from '@/lib/types'

export type StatsBudgetBucketKey =
  | 'socle_fixe'
  | 'variable_essentielle'
  | 'provision'
  | 'discretionnaire'
  | 'cagnotte_projet'

export interface StatsSelectedPeriod {
  id: string | null
  periodYear: number | null
  periodMonth: number | null
  label: string | null
}

export interface StatsReferenceSnapshot {
  loadedAt: string
  selectedPeriod: StatsSelectedPeriod
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
