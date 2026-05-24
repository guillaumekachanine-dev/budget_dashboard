import { budgetDb } from '@/lib/supabaseBudget'
import { useQuery } from '@tanstack/react-query'

export type MonthlyBudgetForecastRow = {
  period_year: number
  period_month: number
  month_start: string
  projected_income: number
  socle_fixe_budget: number
  variable_essentielle_budget: number
  discretionnaire_budget: number
  provision_budget: number
  planned_savings_budget: number
  hors_pilotage_budget: number
  projected_non_savings_expenses: number
  gross_savings_capacity: number
  additional_capacity_after_planned_savings: number
  monthly_capacity_status: string
  monthly_capacity_insight: string
  forward_commitments_amount: number
  forward_socle_fixe: number
  forward_variable_essentielle: number
  forward_discretionnaire: number
  forward_provision: number
  forward_epargne: number
  projected_non_savings_expenses_with_forward: number
  gross_savings_capacity_adjusted: number
  additional_capacity_adjusted: number
}

function asNumber(v: unknown): number {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

function normalize(row: Record<string, unknown>): MonthlyBudgetForecastRow {
  return {
    period_year: asNumber(row.period_year),
    period_month: asNumber(row.period_month),
    month_start: String(row.month_start ?? ''),
    projected_income: asNumber(row.projected_income),
    socle_fixe_budget: asNumber(row.socle_fixe_budget),
    variable_essentielle_budget: asNumber(row.variable_essentielle_budget),
    discretionnaire_budget: asNumber(row.discretionnaire_budget),
    provision_budget: asNumber(row.provision_budget),
    planned_savings_budget: asNumber(row.planned_savings_budget),
    hors_pilotage_budget: asNumber(row.hors_pilotage_budget),
    projected_non_savings_expenses: asNumber(row.projected_non_savings_expenses),
    gross_savings_capacity: asNumber(row.gross_savings_capacity),
    additional_capacity_after_planned_savings: asNumber(row.additional_capacity_after_planned_savings),
    monthly_capacity_status: String(row.monthly_capacity_status ?? ''),
    monthly_capacity_insight: String(row.monthly_capacity_insight ?? ''),
    forward_commitments_amount: asNumber(row.forward_commitments_amount),
    forward_socle_fixe: asNumber(row.forward_socle_fixe),
    forward_variable_essentielle: asNumber(row.forward_variable_essentielle),
    forward_discretionnaire: asNumber(row.forward_discretionnaire),
    forward_provision: asNumber(row.forward_provision),
    forward_epargne: asNumber(row.forward_epargne),
    projected_non_savings_expenses_with_forward: asNumber(row.projected_non_savings_expenses_with_forward),
    gross_savings_capacity_adjusted: asNumber(row.gross_savings_capacity_adjusted),
    additional_capacity_adjusted: asNumber(row.additional_capacity_adjusted),
  }
}

export function useMonthlyBudgetForecast(year: number) {
  return useQuery({
    queryKey: ['monthly-budget-forecast', year],
    queryFn: async (): Promise<MonthlyBudgetForecastRow[]> => {
      const { data, error } = await budgetDb
        .from('v_optimization_monthly_budget_forecast' as never)
        .select('*')
        .eq('period_year', year)
        .order('period_month', { ascending: true })
      if (error) throw error
      return (data ?? []).map((row) => normalize(row as Record<string, unknown>))
    },
    staleTime: 5 * 60_000,
  })
}
