import { budgetDb } from '@/lib/supabaseBudget'

const SUPPORTED_YEAR = 2026

export interface AnnualProjectionOverview2026 {
  monthsElapsed: number | null
  remainingMonths: number | null
  projectedCoreExpensesAmount: number | null
  projectedFlexibleExpensesAmount: number | null
  projectedTotalExpensesAmount: number | null
  projectedRevenueAmount: number | null
  projectedSavingsAmount: number | null
  projectedRevenueAfterSavingsAmount: number | null
  projectedExpensesToRevenuePct: number | null
  projectedSavingsToRevenuePct: number | null
}

type RawAnnualProjectionOverviewRow = {
  months_elapsed: number | null
  remaining_months: number | null
  projected_core_expenses_amount: number | null
  projected_flexible_expenses_amount: number | null
  projected_total_expenses_amount: number | null
  projected_revenue_amount: number | null
  projected_savings_amount: number | null
  projected_revenue_after_savings_amount: number | null
  projected_expenses_to_revenue_pct: number | null
  projected_savings_to_revenue_pct: number | null
}

function toNullableNumber(value: number | null | undefined): number | null {
  if (value == null) return null
  const num = Number(value)
  return Number.isFinite(num) ? num : null
}

function normalizeOverviewRow(row: RawAnnualProjectionOverviewRow): AnnualProjectionOverview2026 {
  return {
    monthsElapsed: toNullableNumber(row.months_elapsed),
    remainingMonths: toNullableNumber(row.remaining_months),
    projectedCoreExpensesAmount: toNullableNumber(row.projected_core_expenses_amount),
    projectedFlexibleExpensesAmount: toNullableNumber(row.projected_flexible_expenses_amount),
    projectedTotalExpensesAmount: toNullableNumber(row.projected_total_expenses_amount),
    projectedRevenueAmount: toNullableNumber(row.projected_revenue_amount),
    projectedSavingsAmount: toNullableNumber(row.projected_savings_amount),
    projectedRevenueAfterSavingsAmount: toNullableNumber(row.projected_revenue_after_savings_amount),
    projectedExpensesToRevenuePct: toNullableNumber(row.projected_expenses_to_revenue_pct),
    projectedSavingsToRevenuePct: toNullableNumber(row.projected_savings_to_revenue_pct),
  }
}

export async function getAnnualProjectionOverview2026(year = SUPPORTED_YEAR): Promise<AnnualProjectionOverview2026 | null> {
  if (year !== SUPPORTED_YEAR) return null

  const { data, error } = await budgetDb
    .from('v_annual_projection_overview_2026')
    .select('*')
    .maybeSingle()

  if (error) throw new Error(`getAnnualProjectionOverview2026 failed: ${error.message}`)
  if (!data) return null

  return normalizeOverviewRow(data as RawAnnualProjectionOverviewRow)
}
