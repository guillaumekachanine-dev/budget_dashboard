import { budgetDb } from '@/lib/supabaseBudget'
import type {
  BudgetBucketTotalSourceRow,
  BudgetBucketVsActualSourceRow,
  MonthlyEvolutionRow,
  SavingsBudgetLineSourceRow,
  SavingsBudgetTotalsSourceRow,
  SavingsBudgetVsActualSourceRow,
} from '@/features/stats/types'
import type { UsableStatsPeriod } from '@/features/stats/api/getLatestUsableStatsPeriod'

export interface StatsReferencePeriodPayload {
  id: string | null
  period_year: number
  period_month: number
  label: string | null
  budget_bucket_totals: BudgetBucketTotalSourceRow[]
  global_variable_budget: number
  total_expense_budget: number
  budget_bucket_vs_actual: BudgetBucketVsActualSourceRow[]
  savings_budget_totals: SavingsBudgetTotalsSourceRow[]
  savings_budget_lines: SavingsBudgetLineSourceRow[]
  savings_budget_vs_actual: SavingsBudgetVsActualSourceRow[]
}

export interface StatsReferenceRpcResult {
  periods: StatsReferencePeriodPayload[]
  monthly_evolution: MonthlyEvolutionRow[]
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null
}

function asNum(v: unknown): number {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

function asNullableStr(v: unknown): string | null {
  return typeof v === 'string' && v.trim().length > 0 ? v.trim() : null
}

function toArray(v: unknown): Record<string, unknown>[] {
  if (!Array.isArray(v)) return []
  return v.filter(isRecord)
}

function parsePeriod(raw: unknown): StatsReferencePeriodPayload | null {
  if (!isRecord(raw)) return null
  return {
    id: asNullableStr(raw.id),
    period_year: asNum(raw.period_year),
    period_month: asNum(raw.period_month),
    label: asNullableStr(raw.label),
    budget_bucket_totals: toArray(raw.budget_bucket_totals),
    global_variable_budget: asNum(raw.global_variable_budget),
    total_expense_budget: asNum(raw.total_expense_budget),
    budget_bucket_vs_actual: toArray(raw.budget_bucket_vs_actual),
    savings_budget_totals: toArray(raw.savings_budget_totals),
    savings_budget_lines: toArray(raw.savings_budget_lines),
    savings_budget_vs_actual: toArray(raw.savings_budget_vs_actual),
  }
}

function parseMonthlyEvolutionRow(raw: Record<string, unknown>): MonthlyEvolutionRow {
  return {
    month_start: asNullableStr(raw.month_start) ?? '',
    period_year: asNum(raw.period_year),
    period_month: asNum(raw.period_month),
    variable_expense_total: asNum(raw.variable_expense_total),
    fixed_expense_total: asNum(raw.fixed_expense_total),
    expense_total: asNum(raw.expense_total),
    income_total: asNum(raw.income_total),
    savings_capacity_observed: asNum(raw.savings_capacity_observed),
    // Remaining AnalyticsMonthlyMetrics fields not returned by this RPC
    refreshed_at: null as unknown as string,
  }
}

function unwrap(data: unknown): StatsReferenceRpcResult {
  const payload = isRecord(data) ? data : {}

  const periods = toArray(payload.periods)
    .map(parsePeriod)
    .filter((p): p is StatsReferencePeriodPayload => p !== null)
    .sort((a, b) =>
      a.period_year !== b.period_year
        ? a.period_year - b.period_year
        : a.period_month - b.period_month,
    )

  const monthly_evolution = toArray(payload.monthly_evolution)
    .map(parseMonthlyEvolutionRow)
    .sort((a, b) =>
      a.period_year !== b.period_year
        ? a.period_year - b.period_year
        : a.period_month - b.period_month,
    )

  return { periods, monthly_evolution }
}

/**
 * Single RPC replacing the N×7 client-side queries in fetchStatsReferenceData.
 * Returns all period data + monthly evolution for the given year in one round-trip.
 */
export async function getStatsReferenceData(
  userId: string,
  year: number,
): Promise<StatsReferenceRpcResult> {
  const { data, error } = await budgetDb.rpc(
    'get_stats_reference_data' as never,
    { p_user_id: userId, p_year: year } as never,
  )

  if (error) {
    throw new Error(`getStatsReferenceData failed: ${error.message}`)
  }

  return unwrap(data)
}

/** Convert an RPC period payload to the UsableStatsPeriod shape expected by selectors. */
export function toUsableStatsPeriod(p: StatsReferencePeriodPayload): UsableStatsPeriod {
  return {
    id: p.id,
    period_year: p.period_year,
    period_month: p.period_month,
    label: p.label,
  }
}
