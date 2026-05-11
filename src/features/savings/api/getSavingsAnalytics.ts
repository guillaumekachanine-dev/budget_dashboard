import { budgetDb } from '@/lib/supabaseBudget'
import type {
  SavingsAnalyticsData,
  SavingsCurrentSummary,
  SavingsDestinationBreakdownRow,
  SavingsMonthlyMetric,
} from '@/features/savings/types'

function asNullableNumber(value: unknown): number | null {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function asNullableString(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

function normalizeCurrentSummary(row: Record<string, unknown> | null): SavingsCurrentSummary | null {
  if (!row) return null

  return {
    total_savings: asNullableNumber(row.total_savings),
    livrets_total: asNullableNumber(row.livrets_total),
    placements_total: asNullableNumber(row.placements_total),
    liquid_savings_total: asNullableNumber(row.liquid_savings_total),
    locked_savings_total: asNullableNumber(row.locked_savings_total),
    accounts_count: asNullableNumber(row.accounts_count),
    livrets_share_pct: asNullableNumber(row.livrets_share_pct),
    placements_share_pct: asNullableNumber(row.placements_share_pct),
    liquid_share_pct: asNullableNumber(row.liquid_share_pct),
    locked_share_pct: asNullableNumber(row.locked_share_pct),
  }
}

function normalizeMonthlyMetric(row: Record<string, unknown>): SavingsMonthlyMetric {
  return {
    month_start: asNullableString(row.month_start),
    period_year: asNullableNumber(row.period_year),
    period_month: asNullableNumber(row.period_month),
    saved_amount: asNullableNumber(row.saved_amount),
    transfer_count: asNullableNumber(row.transfer_count),
    destination_count: asNullableNumber(row.destination_count),
    income_total: asNullableNumber(row.income_total),
    savings_rate_on_income_pct: asNullableNumber(row.savings_rate_on_income_pct),
    savings_budget_total: asNullableNumber(row.savings_budget_total),
    global_budget_total: asNullableNumber(row.global_budget_total),
    savings_share_of_budget_pct: asNullableNumber(row.savings_share_of_budget_pct),
    savings_rolling_avg_3m: asNullableNumber(row.savings_rolling_avg_3m),
    savings_rolling_avg_6m: asNullableNumber(row.savings_rolling_avg_6m),
    annualized_savings_speed_3m: asNullableNumber(row.annualized_savings_speed_3m),
    ytd_saved_amount: asNullableNumber(row.ytd_saved_amount),
  }
}

function normalizeDestinationRow(row: Record<string, unknown>): SavingsDestinationBreakdownRow {
  return {
    month_start: asNullableString(row.month_start),
    period_year: asNullableNumber(row.period_year),
    period_month: asNullableNumber(row.period_month),
    destination_family: asNullableString(row.destination_family),
    destination_label: asNullableString(row.destination_label),
    saved_amount: asNullableNumber(row.saved_amount),
    transfer_count: asNullableNumber(row.transfer_count),
    avg_transfer_amount: asNullableNumber(row.avg_transfer_amount),
  }
}

export async function getSavingsAnalytics(year: number): Promise<SavingsAnalyticsData> {
  const monthlyMetricsQuery = budgetDb
    .from('v_savings_monthly_metrics')
    .select(`
      month_start,
      period_year,
      period_month,
      saved_amount,
      transfer_count,
      destination_count,
      income_total,
      savings_rate_on_income_pct,
      savings_budget_total,
      global_budget_total,
      savings_share_of_budget_pct,
      savings_rolling_avg_3m,
      savings_rolling_avg_6m,
      annualized_savings_speed_3m,
      ytd_saved_amount
    `)
    .eq('period_year', year)
    .order('month_start', { ascending: true })

  const destinationBreakdownQuery = budgetDb
    .from('v_savings_destination_breakdown')
    .select(`
      month_start,
      period_year,
      period_month,
      destination_family,
      destination_label,
      saved_amount,
      transfer_count,
      avg_transfer_amount
    `)
    .eq('period_year', year)
    .order('month_start', { ascending: true })
    .order('saved_amount', { ascending: false })

  const currentSummaryQuery = budgetDb
    .from('v_savings_current_summary')
    .select(`
      total_savings,
      livrets_total,
      placements_total,
      liquid_savings_total,
      locked_savings_total,
      livrets_share_pct,
      placements_share_pct,
      liquid_share_pct,
      locked_share_pct
    `)
    .maybeSingle()

  const [
    { data: monthlyMetricsData, error: monthlyMetricsError },
    { data: destinationBreakdownData, error: destinationBreakdownError },
    { data: currentSummaryData, error: currentSummaryError },
  ] = await Promise.all([monthlyMetricsQuery, destinationBreakdownQuery, currentSummaryQuery])

  if (monthlyMetricsError) {
    throw new Error(`getSavingsAnalytics monthly metrics failed: ${monthlyMetricsError.message}`)
  }

  if (destinationBreakdownError) {
    throw new Error(`getSavingsAnalytics destination breakdown failed: ${destinationBreakdownError.message}`)
  }

  if (currentSummaryError) {
    throw new Error(`getSavingsAnalytics current summary failed: ${currentSummaryError.message}`)
  }

  return {
    monthlyMetrics: (monthlyMetricsData ?? []).map((row) => normalizeMonthlyMetric(row as Record<string, unknown>)),
    destinationBreakdown: (destinationBreakdownData ?? []).map((row) => normalizeDestinationRow(row as Record<string, unknown>)),
    currentSummary: normalizeCurrentSummary((currentSummaryData ?? null) as Record<string, unknown> | null),
  }
}
