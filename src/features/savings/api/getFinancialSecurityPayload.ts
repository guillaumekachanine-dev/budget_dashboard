import { budgetDb } from '@/lib/supabaseBudget'
import type {
  FinancialSecurityMonthlyEssential,
  FinancialSecurityPayload,
  FinancialSecuritySummary,
} from '@/features/savings/types'

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

function normalizeSummary(row: Record<string, unknown> | null): FinancialSecuritySummary | null {
  if (!row) return null

  return {
    total_savings: asNullableNumber(row.total_savings),
    livrets_total: asNullableNumber(row.livrets_total),
    placements_total: asNullableNumber(row.placements_total),
    liquid_savings_total: asNullableNumber(row.liquid_savings_total),
    locked_savings_total: asNullableNumber(row.locked_savings_total),
    reference_essential_monthly_spending: asNullableNumber(row.reference_essential_monthly_spending),
    essential_avg_3m: asNullableNumber(row.essential_avg_3m),
    essential_avg_6m: asNullableNumber(row.essential_avg_6m),
    essential_avg_12m: asNullableNumber(row.essential_avg_12m),
    latest_completed_month_essential_spending: asNullableNumber(row.latest_completed_month_essential_spending),
    previous_completed_month_essential_spending: asNullableNumber(row.previous_completed_month_essential_spending),
    latest_essential_spending_change_pct: asNullableNumber(row.latest_essential_spending_change_pct),
    minimum_target_amount: asNullableNumber(row.minimum_target_amount),
    comfort_target_amount: asNullableNumber(row.comfort_target_amount),
    premium_target_amount: asNullableNumber(row.premium_target_amount),
    security_months_3m_basis: asNullableNumber(row.security_months_3m_basis),
    security_months_6m_basis: asNullableNumber(row.security_months_6m_basis),
    security_months_12m_basis: asNullableNumber(row.security_months_12m_basis),
    security_months_reference: asNullableNumber(row.security_months_reference),
    comfort_target_surplus_or_gap: asNullableNumber(row.comfort_target_surplus_or_gap),
    premium_target_surplus_or_gap: asNullableNumber(row.premium_target_surplus_or_gap),
    security_status: asNullableString(row.security_status),
    security_insight: asNullableString(row.security_insight),
    allocation_signal: asNullableString(row.allocation_signal),
    monthly_effort_to_premium_target_in_6m: asNullableNumber(row.monthly_effort_to_premium_target_in_6m),
    monthly_effort_to_premium_target_in_12m: asNullableNumber(row.monthly_effort_to_premium_target_in_12m),
  }
}

function normalizeMonthlyEssential(row: Record<string, unknown>): FinancialSecurityMonthlyEssential {
  return {
    month_start: asNullableString(row.month_start),
    period_year: asNullableNumber(row.period_year),
    period_month: asNullableNumber(row.period_month),
    socle_fixe_amount: asNullableNumber(row.socle_fixe_amount),
    variable_essentielle_amount: asNullableNumber(row.variable_essentielle_amount),
    essential_spending_total: asNullableNumber(row.essential_spending_total),
    transaction_count: asNullableNumber(row.transaction_count),
  }
}

function unwrapPayload(data: unknown): Record<string, unknown> | null {
  const direct = asRecord(data)
  if (direct && ('summary' in direct || 'monthly_essentials' in direct)) {
    return direct
  }

  if (Array.isArray(data) && data.length > 0) {
    const first = asRecord(data[0])
    if (!first) return null

    if ('summary' in first || 'monthly_essentials' in first) {
      return first
    }

    const nested = asRecord(first.get_financial_security_payload)
    if (nested && ('summary' in nested || 'monthly_essentials' in nested)) {
      return nested
    }
  }

  if (direct) {
    const nested = asRecord(direct.get_financial_security_payload)
    if (nested && ('summary' in nested || 'monthly_essentials' in nested)) {
      return nested
    }
  }

  return null
}

export async function getFinancialSecurityPayload(): Promise<FinancialSecurityPayload | null> {
  const { data, error } = await budgetDb().rpc('get_financial_security_payload')

  if (error) {
    throw new Error(`getFinancialSecurityPayload failed: ${error.message}`)
  }

  const payload = unwrapPayload(data)
  if (!payload) return null

  const summary = normalizeSummary(asRecord(payload.summary))
  const monthlyEssentialsRaw = Array.isArray(payload.monthly_essentials) ? payload.monthly_essentials : []

  return {
    generated_at: asNullableString(payload.generated_at),
    summary,
    monthly_essentials: monthlyEssentialsRaw
      .map((row) => asRecord(row))
      .filter((row): row is Record<string, unknown> => row != null)
      .map((row) => normalizeMonthlyEssential(row)),
  }
}
