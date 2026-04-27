import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { Budget, BudgetPeriod, CategoryBudgetSummary } from '@/lib/types'

async function fetchCurrentPeriod(year: number, month: number): Promise<BudgetPeriod | null> {
  const { data, error } = await supabase
    .schema('budget_dashboard')
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

  const { data: budgets, error: bErr } = await supabase
    .from('budgets')
    .select('*, category:categories(*)')
    .eq('period_id', period.id)
    .eq('budget_kind', 'category')

  if (bErr) throw bErr

  const start = period.starts_on
  const end = period.ends_on

  const summaries = await Promise.all(
    (budgets as Budget[]).map(async (budget) => {
      if (!budget.category) return null

      const { data: txns, error: tErr } = await supabase
        .from('transactions')
        .select('amount')
        .eq('category_id', budget.category_id!)
        .eq('flow_type', 'expense')
        .gte('transaction_date', start)
        .lte('transaction_date', end)

      if (tErr) throw tErr

      const spent = (txns ?? []).reduce((sum, t) => sum + Number(t.amount), 0)
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
  )

  return summaries.filter((s): s is CategoryBudgetSummary => s !== null)
    .sort((a, b) => b.percentage - a.percentage)
}

export function useBudgetSummaries(year: number, month: number) {
  return useQuery({
    queryKey: ['budgets', year, month],
    queryFn: () => fetchBudgetSummaries(year, month),
    staleTime: 30_000,
  })
}

export function useCurrentPeriod(year: number, month: number) {
  return useQuery({
    queryKey: ['period', year, month],
    queryFn: () => fetchCurrentPeriod(year, month),
    staleTime: 60_000,
  })
}
