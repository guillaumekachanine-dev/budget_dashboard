import { budgetDb } from '@/lib/supabaseBudget'
import type {
  OptimizationAnnualSummary,
  OptimizationCapacityPayload,
  OptimizationCurrentAccountBalance,
  OptimizationFinancialSecurityReference,
  OptimizationLever,
  OptimizationMonthlyForecast,
  OptimizationScenario,
} from '@/features/stats/types'

function asRecord(value: unknown): Record<string, unknown> | null {
  if (typeof value !== 'object' || value === null) return null
  return value as Record<string, unknown>
}

function asNullableNumber(value: unknown): number | null {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function asNullableString(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

function unwrapPayload(data: unknown): Record<string, unknown> | null {
  const direct = asRecord(data)
  if (direct && ('annual_summary' in direct || 'monthly_forecast' in direct)) return direct

  if (Array.isArray(data) && data.length > 0) {
    const first = asRecord(data[0])
    if (!first) return null
    if ('annual_summary' in first || 'monthly_forecast' in first) return first

    const nested = asRecord(first.get_optimization_capacity_payload)
    if (nested && ('annual_summary' in nested || 'monthly_forecast' in nested)) return nested
  }

  if (direct) {
    const nested = asRecord(direct.get_optimization_capacity_payload)
    if (nested && ('annual_summary' in nested || 'monthly_forecast' in nested)) return nested
  }

  return null
}

function normalizeCurrentAccountBalance(row: Record<string, unknown> | null): OptimizationCurrentAccountBalance | null {
  if (!row) return null

  return {
    amount: asNullableNumber(row.amount ?? row.current_balance ?? row.estimated_balance),
    currency: asNullableString(row.currency),
    as_of_date: asNullableString(row.as_of_date ?? row.generated_at ?? row.reference_date),
  }
}

function normalizeFinancialSecurityReference(
  row: Record<string, unknown> | null,
): OptimizationFinancialSecurityReference | null {
  if (!row) return null

  return {
    security_months_reference: asNullableNumber(row.security_months_reference),
    liquid_savings_total: asNullableNumber(row.liquid_savings_total),
    reference_essential_monthly_spending: asNullableNumber(row.reference_essential_monthly_spending),
    security_status: asNullableString(row.security_status),
  }
}

function normalizeAnnualSummary(row: Record<string, unknown> | null): OptimizationAnnualSummary | null {
  if (!row) return null

  return {
    gross_savings_capacity_total: asNullableNumber(row.gross_savings_capacity_total),
    avg_monthly_gross_savings_capacity: asNullableNumber(row.avg_monthly_gross_savings_capacity),
    planned_savings_total: asNullableNumber(row.planned_savings_total),
    additional_capacity_after_planned_savings_total: asNullableNumber(row.additional_capacity_after_planned_savings_total),
    risk_months_count: asNullableNumber(row.risk_months_count),
  }
}

function normalizeMonthlyForecast(row: Record<string, unknown>): OptimizationMonthlyForecast {
  return {
    month_start: asNullableString(row.month_start),
    period_year: asNullableNumber(row.period_year),
    period_month: asNullableNumber(row.period_month),
    projected_income: asNullableNumber(row.projected_income),
    projected_non_savings_expenses: asNullableNumber(row.projected_non_savings_expenses),
    planned_savings_budget: asNullableNumber(row.planned_savings_budget),
    gross_savings_capacity: asNullableNumber(row.gross_savings_capacity),
    additional_capacity_after_planned_savings: asNullableNumber(row.additional_capacity_after_planned_savings),
    estimated_current_account_end_balance: asNullableNumber(row.estimated_current_account_end_balance),
    forecast_status: asNullableString(row.forecast_status),
  }
}

function normalizeOptimizationLever(row: Record<string, unknown>): OptimizationLever {
  return {
    category_name: asNullableString(row.category_name),
    parent_category_name: asNullableString(row.parent_category_name),
    budget_bucket: asNullableString(row.budget_bucket),
    avg_monthly_amount_6m: asNullableNumber(row.avg_monthly_amount_6m),
    realistic_monthly_gain: asNullableNumber(row.realistic_monthly_gain),
    realistic_annual_gain: asNullableNumber(row.realistic_annual_gain),
    optimization_comment: asNullableString(row.optimization_comment),
  }
}

function normalizeScenario(row: Record<string, unknown>): OptimizationScenario {
  return {
    scenario_label: asNullableString(row.scenario_label),
    monthly_gain: asNullableNumber(row.monthly_gain),
    projected_gain_on_scope: asNullableNumber(row.projected_gain_on_scope),
    projected_capacity_total: asNullableNumber(row.projected_capacity_total),
  }
}

function toRecordArray(value: unknown): Record<string, unknown>[] {
  if (!Array.isArray(value)) return []
  return value
    .map((entry) => asRecord(entry))
    .filter((entry): entry is Record<string, unknown> => entry != null)
}

export async function getOptimizationCapacityPayload(year: number): Promise<OptimizationCapacityPayload | null> {
  const { data, error } = await budgetDb().rpc('get_optimization_capacity_payload', { p_year: year })

  if (error) {
    throw new Error(`getOptimizationCapacityPayload failed: ${error.message}`)
  }

  const payload = unwrapPayload(data)
  if (!payload) return null

  return {
    generated_at: asNullableString(payload.generated_at),
    year: asNullableNumber(payload.year),
    current_account_balance: normalizeCurrentAccountBalance(asRecord(payload.current_account_balance)),
    financial_security_reference: normalizeFinancialSecurityReference(asRecord(payload.financial_security_reference)),
    annual_summary: normalizeAnnualSummary(asRecord(payload.annual_summary)),
    monthly_forecast: toRecordArray(payload.monthly_forecast).map((row) => normalizeMonthlyForecast(row)),
    optimization_levers: toRecordArray(payload.optimization_levers).map((row) => normalizeOptimizationLever(row)),
    scenarios: toRecordArray(payload.scenarios).map((row) => normalizeScenario(row)),
  }
}
