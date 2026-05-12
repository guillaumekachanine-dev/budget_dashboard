import { budgetDb } from '@/lib/supabaseBudget'

const ALL_CATEGORIES_SCOPE_ID = 'all_categories'
const SUPPORTED_YEAR = 2026

export type CategoryAnnualCostProjectionScope =
  | { kind: 'bloc'; id: string }
  | { kind: 'categorie'; id: string }
  | undefined

export interface CategoryAnnualCostProjection2026 {
  categoryId: string
  categoryName: string
  parentCategoryName: string
  budgetBucket: string
  monthsElapsed: number
  remainingMonths: number
  actualYtdAmount: number
  avgMonthlyYtdAmount: number
  projectedRemainingAmount: number
  projectedAnnualAmount: number
  budgetYtdAmount: number
  budgetAnnualAmount: number
  projectedVsBudgetAmount: number
  projectedVsBudgetPct: number
}

type RawProjectionRow = {
  category_id: string | null
  category_name: string | null
  parent_category_name: string | null
  budget_bucket: string | null
  months_elapsed: number | null
  remaining_months: number | null
  actual_ytd_amount: number | null
  avg_monthly_ytd_amount: number | null
  projected_remaining_amount: number | null
  projected_annual_amount: number | null
  budget_ytd_amount: number | null
  budget_annual_amount: number | null
  projected_vs_budget_amount: number | null
  projected_vs_budget_pct: number | null
}

function toNumber(value: number | null | undefined): number {
  return Number(value ?? 0)
}

function normalizeRow(row: RawProjectionRow): CategoryAnnualCostProjection2026 | null {
  const categoryId = row.category_id?.trim() ?? ''
  if (!categoryId) return null

  const categoryName = row.category_name?.trim() ?? ''
  const parentCategoryName = row.parent_category_name?.trim() ?? categoryName

  return {
    categoryId,
    categoryName,
    parentCategoryName,
    budgetBucket: row.budget_bucket?.trim() ?? '',
    monthsElapsed: toNumber(row.months_elapsed),
    remainingMonths: toNumber(row.remaining_months),
    actualYtdAmount: toNumber(row.actual_ytd_amount),
    avgMonthlyYtdAmount: toNumber(row.avg_monthly_ytd_amount),
    projectedRemainingAmount: toNumber(row.projected_remaining_amount),
    projectedAnnualAmount: toNumber(row.projected_annual_amount),
    budgetYtdAmount: toNumber(row.budget_ytd_amount),
    budgetAnnualAmount: toNumber(row.budget_annual_amount),
    projectedVsBudgetAmount: toNumber(row.projected_vs_budget_amount),
    projectedVsBudgetPct: toNumber(row.projected_vs_budget_pct),
  }
}

export async function getCategoryAnnualCostProjection2026(
  scopeSelection: CategoryAnnualCostProjectionScope,
  year = SUPPORTED_YEAR,
): Promise<CategoryAnnualCostProjection2026[]> {
  if (year !== SUPPORTED_YEAR) return []

  let query = budgetDb
    .from('v_category_annual_cost_projection_2026')
    .select('*')

  if (scopeSelection?.kind === 'bloc') {
    query = query.eq('budget_bucket', scopeSelection.id)
  } else if (scopeSelection?.kind === 'categorie' && scopeSelection.id !== ALL_CATEGORIES_SCOPE_ID) {
    query = query.eq('category_id', scopeSelection.id)
  }

  const { data, error } = await query.order('projected_annual_amount', { ascending: false })
  if (error) throw new Error(`getCategoryAnnualCostProjection2026 failed: ${error.message}`)

  return (data ?? [])
    .map((row) => normalizeRow(row as RawProjectionRow))
    .filter((row): row is CategoryAnnualCostProjection2026 => row !== null)
}
