import { budgetDb } from '@/lib/supabaseBudget'
import type {
  InvestmentAccountPerformanceSummary,
  InvestmentActionItem,
  InvestmentCashflow,
  InvestmentGlobalSummary,
  InvestmentMonthlyPerformance,
  InvestmentPerformancePayload,
  InvestmentPositionSnapshot,
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

function toRecordArray(value: unknown): Record<string, unknown>[] {
  if (!Array.isArray(value)) return []
  return value
    .map((entry) => asRecord(entry))
    .filter((entry): entry is Record<string, unknown> => entry != null)
}

function unwrapPayload(data: unknown): Record<string, unknown> | null {
  const direct = asRecord(data)
  if (direct && ('global_summary' in direct || 'accounts' in direct)) {
    return direct
  }

  if (Array.isArray(data) && data.length > 0) {
    const first = asRecord(data[0])
    if (!first) return null

    if ('global_summary' in first || 'accounts' in first) {
      return first
    }

    const nested = asRecord(first.get_investment_performance_payload)
    if (nested && ('global_summary' in nested || 'accounts' in nested)) {
      return nested
    }
  }

  if (direct) {
    const nested = asRecord(direct.get_investment_performance_payload)
    if (nested && ('global_summary' in nested || 'accounts' in nested)) {
      return nested
    }
  }

  return null
}

function normalizeGlobalSummary(row: Record<string, unknown> | null): InvestmentGlobalSummary | null {
  if (!row) return null

  return {
    total_invested_value: asNullableNumber(row.total_invested_value ?? row.invested_value_total ?? row.portfolio_value_total),
    total_investment_cash: asNullableNumber(row.total_investment_cash ?? row.cash_total ?? row.investment_cash_total),
    estimated_gain_vs_known_cash_in: asNullableNumber(row.estimated_gain_vs_known_cash_in ?? row.gain_vs_known_cash_in),
    estimated_gain_vs_known_cash_in_pct: asNullableNumber(row.estimated_gain_vs_known_cash_in_pct ?? row.gain_vs_known_cash_in_pct),
    avg_quality_score: asNullableNumber(row.avg_quality_score ?? row.global_quality_score),
    global_investment_insight: asNullableString(row.global_investment_insight ?? row.insight),
  }
}

function normalizeAccountSummary(row: Record<string, unknown>): InvestmentAccountPerformanceSummary {
  return {
    account_name: asNullableString(row.account_name),
    provider_name: asNullableString(row.provider_name),
    product_name: asNullableString(row.product_name),
    envelope_type: asNullableString(row.envelope_type),
    current_value: asNullableNumber(row.current_value ?? row.total_value),
    current_value_source: asNullableString(row.current_value_source),
    estimated_gain_vs_total_cash_in: asNullableNumber(row.estimated_gain_vs_total_cash_in ?? row.gain_vs_total_cash_in),
    estimated_gain_vs_total_cash_in_pct: asNullableNumber(row.estimated_gain_vs_total_cash_in_pct ?? row.gain_vs_total_cash_in_pct),
    global_quality_score: asNullableNumber(row.global_quality_score ?? row.quality_score),
    quality_status: asNullableString(row.quality_status),
    recommended_action: asNullableString(row.recommended_action),
  }
}

function normalizeMonthlyPerformance(row: Record<string, unknown>): InvestmentMonthlyPerformance {
  return {
    month_start: asNullableString(row.month_start),
    period_year: asNullableNumber(row.period_year),
    period_month: asNullableNumber(row.period_month),
    total_value: asNullableNumber(row.total_value ?? row.portfolio_value ?? row.current_value),
    total_cash_in: asNullableNumber(row.total_cash_in),
    total_cash_out: asNullableNumber(row.total_cash_out),
    net_gain: asNullableNumber(row.net_gain ?? row.gain_amount ?? row.estimated_gain_vs_known_cash_in),
    net_gain_pct: asNullableNumber(row.net_gain_pct ?? row.gain_pct ?? row.estimated_gain_vs_known_cash_in_pct),
    monthly_return: asNullableNumber(row.monthly_return ?? row.performance_amount),
    monthly_return_pct: asNullableNumber(row.monthly_return_pct ?? row.performance_pct),
    quality_score: asNullableNumber(row.quality_score ?? row.global_quality_score),
  }
}

function normalizeCashflow(row: Record<string, unknown>): InvestmentCashflow {
  return {
    flow_date: asNullableString(row.flow_date ?? row.date ?? row.transaction_date),
    account_name: asNullableString(row.account_name),
    flow_type: asNullableString(row.flow_type ?? row.type ?? row.direction),
    amount: asNullableNumber(row.amount),
    description: asNullableString(row.description ?? row.label ?? row.note),
  }
}

function normalizeActionItem(row: Record<string, unknown>): InvestmentActionItem {
  return {
    action_title: asNullableString(row.action_title),
    account_name: asNullableString(row.account_name),
    action_description: asNullableString(row.action_description),
    priority: asNullableNumber(row.priority),
    expected_impact_label: asNullableString(row.expected_impact_label),
    expected_annual_saving: asNullableNumber(row.expected_annual_saving ?? row.expected_annual_gain),
    expected_performance_improvement_label: asNullableString(row.expected_performance_improvement_label),
    status: asNullableString(row.status),
  }
}

function normalizePositionSnapshot(row: Record<string, unknown>): InvestmentPositionSnapshot {
  return {
    asset_name: asNullableString(row.asset_name ?? row.asset_label ?? row.security_name),
    snapshot_date: asNullableString(row.snapshot_date ?? row.as_of_date),
    units: asNullableNumber(row.units),
    unit_price: asNullableNumber(row.unit_price),
    market_value: asNullableNumber(row.market_value),
    cash_value: asNullableNumber(row.cash_value),
    total_value: asNullableNumber(row.total_value),
    source_document: asNullableString(row.source_document ?? row.document_name ?? row.file_name),
  }
}

export async function getInvestmentPerformancePayload(year: number): Promise<InvestmentPerformancePayload | null> {
  const { data, error } = await budgetDb().rpc('get_investment_performance_payload', { p_year: year })

  if (error) {
    throw new Error(`getInvestmentPerformancePayload failed: ${error.message}`)
  }

  const payload = unwrapPayload(data)
  if (!payload) return null

  return {
    generated_at: asNullableString(payload.generated_at),
    year: asNullableNumber(payload.year),
    global_summary: normalizeGlobalSummary(asRecord(payload.global_summary)),
    accounts: toRecordArray(payload.accounts).map((row) => normalizeAccountSummary(row)),
    monthly_performance: toRecordArray(payload.monthly_performance).map((row) => normalizeMonthlyPerformance(row)),
    cashflows: toRecordArray(payload.cashflows).map((row) => normalizeCashflow(row)),
    actions: toRecordArray(payload.actions).map((row) => normalizeActionItem(row)),
    latest_positions: toRecordArray(payload.latest_positions).map((row) => normalizePositionSnapshot(row)),
  }
}
