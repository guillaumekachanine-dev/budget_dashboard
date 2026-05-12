import { budgetDb } from '@/lib/supabaseBudget'
import type { YtdFlowRow } from '@/features/annual-analysis/types.compared'
import { COMPARED_MONTHS, COMPARED_YEARS } from '@/features/annual-analysis/types.compared'

/**
 * Flux globaux mensuels pour 2025 et 2026, filtrés sur Jan-Avr.
 * Source : analytics_monthly_metrics (couvre 2025 complet + 2026 jusqu'à présent).
 */
export async function getComparedYtdFlows(): Promise<YtdFlowRow[]> {
  const { data, error } = await budgetDb
    .from('analytics_monthly_metrics')
    .select(
      'period_year, period_month, expense_total, income_total, fixed_expense_total, variable_expense_total, savings_capacity_observed',
    )
    .in('period_year', [...COMPARED_YEARS])
    .in('period_month', [...COMPARED_MONTHS])
    .order('period_year', { ascending: true })
    .order('period_month', { ascending: true })

  if (error) throw new Error(`getComparedYtdFlows: ${error.message}`)

  return (data ?? []).map((row) => ({
    period_year:               Number(row.period_year),
    period_month:              Number(row.period_month),
    expense_total:             Number(row.expense_total ?? 0),
    income_total:              Number(row.income_total ?? 0),
    fixed_expense_total:       Number(row.fixed_expense_total ?? 0),
    variable_expense_total:    Number(row.variable_expense_total ?? 0),
    savings_capacity_observed: Number(row.savings_capacity_observed ?? 0),
  }))
}
