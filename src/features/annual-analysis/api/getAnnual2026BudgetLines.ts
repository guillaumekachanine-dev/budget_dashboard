import { budgetDb } from '@/lib/supabaseBudget'

export interface Budget2026Line {
  category_name: string
  parent_category_name: string
  amount: number
  effective_bucket: string
  method: string
}

export async function getAnnual2026BudgetLines(): Promise<Budget2026Line[]> {
  const { data, error } = await budgetDb()
    .from('expense_budget_lines')
    .select('category_name, parent_category_name, amount, effective_bucket, method')
    .order('amount', { ascending: false })

  if (error) {
    throw new Error(`getAnnual2026BudgetLines failed: ${error.message}`)
  }

  return (data ?? []) as unknown as Budget2026Line[]
}
