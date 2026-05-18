import { useQuery } from '@tanstack/react-query'
import { budgetDb } from '@/lib/supabaseBudget'
import type { Budget, BudgetPeriod, CategoryBudgetSummary } from '@/lib/types'

async function fetchCurrentPeriod(year: number, month: number): Promise<BudgetPeriod | null> {
  const { data, error } = await budgetDb
    .from('budget_periods')
    .select('*')
    .eq('period_year', year)
    .eq('period_month', month)

  if (error) return null
  return data?.[0] ?? null
}

async function fetchBudgetSummaries(year: number, month: number): Promise<CategoryBudgetSummary[]> {
  const period = await fetchCurrentPeriod(year, month)
  if (!period) return []

  const { data: budgets, error: bErr } = await budgetDb
    .from('budgets')
    .select('*, category:categories(*)')
    .eq('period_id', period.id)
    .eq('budget_kind', 'category')

  if (bErr) throw bErr

  const start = period.starts_on
  const end = period.ends_on
  const budgetRows = (budgets as Budget[]).filter((budget) => budget.category && budget.category_id)
  const categoryIds = budgetRows.map((budget) => budget.category_id!).filter((id): id is string => Boolean(id))

  const spentByCategory = new Map<string, number>()

  if (categoryIds.length > 0) {
    const { data: txns, error: txErr } = await budgetDb
      .from('transactions')
      .select('category_id, amount')
      .eq('flow_type', 'expense')
      .eq('is_hidden', false)
      .in('category_id', categoryIds)
      .gte('transaction_date', start)
      .lte('transaction_date', end)

    if (txErr) throw txErr

    for (const txn of txns ?? []) {
      if (!txn.category_id) continue
      const prev = spentByCategory.get(txn.category_id) ?? 0
      spentByCategory.set(txn.category_id, prev + Number(txn.amount))
    }
  }

  const summaries = budgetRows.map((budget) => {
    const spent = spentByCategory.get(budget.category_id!) ?? 0
    const budgetAmount = Number(budget.amount)
    const percentage = budgetAmount > 0 ? (spent / budgetAmount) * 100 : 0

    return {
      category: budget.category!,
      budget_amount: budgetAmount,
      spent_amount: spent,
      remaining: budgetAmount - spent,
      percentage,
    } satisfies CategoryBudgetSummary
  })

  return summaries.filter((s): s is CategoryBudgetSummary => s !== null)
    .sort((a, b) => b.percentage - a.percentage)
}

export function useBudgetSummaries(year: number, month: number) {
  return useQuery({
    queryKey: ['budgets', year, month],
    queryFn: () => fetchBudgetSummaries(year, month),
    staleTime: 5 * 60_000,
  })
}

export function useCurrentPeriod(year: number, month: number) {
  return useQuery({
    queryKey: ['period', year, month],
    queryFn: () => fetchCurrentPeriod(year, month),
    staleTime: 60_000,
  })
}
