import { budgetDb } from '@/lib/supabaseBudget'
import type {
  BudgetLinesForPeriodResult,
  BudgetLineWithCategory,
  BudgetRecommendationApplied,
  GlobalVariableBudgetLine,
} from '@/features/budget/types'
import { getBudgetRecommendationsForAppliedPeriod } from '@/features/budget/api/getBudgetRecommendationsForAppliedPeriod'

type GetBudgetLinesParams =
  | { periodId: string; year?: never; month?: never }
  | { periodId?: never; year: number; month: number }

interface BudgetRow {
  id: string
  period_id: string
  category_id: string | null
  budget_kind: 'category' | 'global_variable'
  amount: number
  currency: string
  notes: string | null
}

interface CategoryRow {
  id: string
  name: string
  parent_id: string | null
  icon_key: string | null
}

const BUDGET_COLUMNS = ['id', 'period_id', 'category_id', 'budget_kind', 'amount', 'currency', 'notes'].join(', ')
const CATEGORY_COLUMNS = ['id', 'name', 'parent_id', 'icon_key'].join(', ')

async function resolvePeriodId(params: GetBudgetLinesParams): Promise<string> {
  if ('periodId' in params && params.periodId) return params.periodId

  const year = 'year' in params ? params.year : undefined
  const month = 'month' in params ? params.month : undefined

  if (typeof year !== 'number' || typeof month !== 'number') {
    throw new Error('getBudgetLinesForPeriod requires either periodId or year/month')
  }

  const { data, error } = await budgetDb()
    .from('budget_periods')
    .select('id')
    .eq('period_year', year)
    .eq('period_month', month)
    .limit(1)
    .maybeSingle()

  if (error) {
    throw new Error(`getBudgetLinesForPeriod failed (resolve period): ${error.message}`)
  }

  if (!data?.id) {
    throw new Error(`Aucune période budgétaire trouvée pour ${month}/${year}`)
  }

  return data.id
}

function mergeRecommendations(
  lines: BudgetLineWithCategory[],
  recommendations: BudgetRecommendationApplied[],
): BudgetLineWithCategory[] {
  const byCategoryId = new Map<string, BudgetRecommendationApplied>()

  for (const recommendation of recommendations) {
    if (!recommendation.category_id) continue
    const already = byCategoryId.get(recommendation.category_id)

    if (!already || recommendation.decision_status === 'applied') {
      byCategoryId.set(recommendation.category_id, recommendation)
    }
  }

  return lines.map((line) => {
    if (!line.category_id) return line
    const recommendation = byCategoryId.get(line.category_id)
    if (!recommendation) return line

    return {
      ...line,
      budget_bucket: recommendation.budget_bucket,
      budget_method: recommendation.budget_method,
      decision_status: recommendation.decision_status,
      final_budget_monthly_eur: recommendation.final_budget_monthly_eur,
      manual_budget_monthly_eur: recommendation.manual_budget_monthly_eur,
      recommendation_comment: recommendation.recommendation_comment,
    }
  })
}

export async function getBudgetLinesForPeriod(params: GetBudgetLinesParams): Promise<BudgetLinesForPeriodResult> {
  const periodId = await resolvePeriodId(params)

  const { data: budgetData, error: budgetError } = await budgetDb()
    .from('budgets')
    .select(BUDGET_COLUMNS)
    .eq('period_id', periodId)
    .in('budget_kind', ['category', 'global_variable'])
    .order('budget_kind', { ascending: true })

  if (budgetError) {
    throw new Error(`getBudgetLinesForPeriod failed (budgets): ${budgetError.message}`)
  }

  const rows = (budgetData ?? []) as unknown as BudgetRow[]

  const globalVariableLine = rows.find((row) => row.budget_kind === 'global_variable')

  const rawCategoryLines = rows.filter((row) => row.budget_kind === 'category')
  const categoryIds = rawCategoryLines
    .map((row) => row.category_id)
    .filter((value): value is string => Boolean(value))

  const categoryRowsById = new Map<string, CategoryRow>()

  if (categoryIds.length > 0) {
    const { data: categoriesData, error: categoriesError } = await budgetDb()
      .from('categories')
      .select(CATEGORY_COLUMNS)
      .in('id', categoryIds)

    if (categoriesError) {
      throw new Error(`getBudgetLinesForPeriod failed (categories): ${categoriesError.message}`)
    }

    const categoriesRows = (categoriesData ?? []) as unknown as CategoryRow[]

    for (const category of categoriesRows) {
      categoryRowsById.set(category.id, {
        id: category.id,
        name: category.name,
        parent_id: category.parent_id,
        icon_key: category.icon_key,
      })
    }

    const parentIds = [...new Set(categoriesRows.map((row) => row.parent_id).filter((value): value is string => Boolean(value)))]

    if (parentIds.length > 0) {
      const { data: parentCategoriesData, error: parentCategoriesError } = await budgetDb()
        .from('categories')
        .select(CATEGORY_COLUMNS)
        .in('id', parentIds)

      if (parentCategoriesError) {
        throw new Error(`getBudgetLinesForPeriod failed (parent categories): ${parentCategoriesError.message}`)
      }

      const parentRows = (parentCategoriesData ?? []) as unknown as CategoryRow[]

      for (const parentCategory of parentRows) {
        categoryRowsById.set(parentCategory.id, {
          id: parentCategory.id,
          name: parentCategory.name,
          parent_id: parentCategory.parent_id,
          icon_key: parentCategory.icon_key,
        })
      }
    }
  }

  const baseCategoryLines: BudgetLineWithCategory[] = rawCategoryLines.map((row) => {
    const category = row.category_id ? categoryRowsById.get(row.category_id) : null
    const parentCategory = category?.parent_id ? categoryRowsById.get(category.parent_id) : null

    return {
      id: row.id,
      period_id: row.period_id,
      category_id: row.category_id,
      budget_kind: row.budget_kind,
      amount: Number(row.amount ?? 0),
      currency: row.currency,
      notes: row.notes,
      category_name: category?.name ?? null,
      category_icon_key: category?.icon_key ?? null,
      parent_category_id: category?.parent_id ?? null,
      parent_category_name: parentCategory?.name ?? null,
      parent_category_icon_key: parentCategory?.icon_key ?? null,
      budget_bucket: null,
      budget_method: null,
      decision_status: null,
      final_budget_monthly_eur: null,
      manual_budget_monthly_eur: null,
      recommendation_comment: null,
    }
  })

  const recommendations = await getBudgetRecommendationsForAppliedPeriod(periodId).catch(() => [])
  const categoryLines = mergeRecommendations(baseCategoryLines, recommendations)

  const globalBudgetLine: GlobalVariableBudgetLine | null = globalVariableLine
    ? {
        id: globalVariableLine.id,
        period_id: globalVariableLine.period_id,
        budget_kind: 'global_variable',
        amount: Number(globalVariableLine.amount ?? 0),
        currency: globalVariableLine.currency,
        notes: globalVariableLine.notes,
      }
    : null

  return {
    periodId,
    categoryLines,
    globalVariableLine: globalBudgetLine,
  }
}
