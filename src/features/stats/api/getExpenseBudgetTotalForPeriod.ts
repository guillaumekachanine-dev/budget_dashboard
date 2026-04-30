import { budgetDb } from '@/lib/supabaseBudget'
import { asSafeNumber, resolvePeriodIdByYearMonth } from '@/features/stats/api/_shared'

interface BudgetCategoryRow {
  amount: number
  category_id: string | null
}

interface CategoryFlowRow {
  id: string
  flow_type: string
}

export async function getExpenseBudgetTotalForPeriod(
  periodYear: number,
  periodMonth: number,
): Promise<number> {
  const periodId = await resolvePeriodIdByYearMonth(periodYear, periodMonth)

  const { data: budgetRowsData, error: budgetError } = await budgetDb()
    .from('budgets')
    .select('amount, category_id')
    .eq('period_id', periodId)
    .eq('budget_kind', 'category')

  if (budgetError) {
    throw new Error(`getExpenseBudgetTotalForPeriod failed (budgets): ${budgetError.message}`)
  }

  const budgetRows = (budgetRowsData ?? []) as unknown as BudgetCategoryRow[]
  const categoryIds = budgetRows
    .map((row) => row.category_id)
    .filter((categoryId): categoryId is string => Boolean(categoryId))

  if (categoryIds.length === 0) {
    return 0
  }

  const { data: categoriesData, error: categoriesError } = await budgetDb()
    .from('categories')
    .select('id, flow_type')
    .in('id', categoryIds)
    .eq('flow_type', 'expense')

  if (categoriesError) {
    throw new Error(`getExpenseBudgetTotalForPeriod failed (categories): ${categoriesError.message}`)
  }

  const expenseCategorySet = new Set(
    ((categoriesData ?? []) as unknown as CategoryFlowRow[]).map((row) => row.id),
  )

  return budgetRows.reduce((sum, row) => {
    if (!row.category_id || !expenseCategorySet.has(row.category_id)) return sum
    return sum + asSafeNumber(row.amount)
  }, 0)
}
