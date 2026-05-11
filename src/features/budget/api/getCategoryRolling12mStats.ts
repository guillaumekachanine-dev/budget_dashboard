import { budgetDb } from '@/lib/supabaseBudget'

export type CategoryRolling12mStats = {
  category_id: string
  category_name: string | null
  parent_category_name: string | null
  budget_bucket: string | null
  avg_monthly_amount_12m: number | null
  median_monthly_amount_12m: number | null
  max_monthly_amount_12m: number | null
  active_months_count: number | null
  months_analyzed: number | null
}

export async function getCategoryRolling12mStats(): Promise<CategoryRolling12mStats[]> {
  const { data, error } = await budgetDb
    .from('v_category_rolling_12m_stats' as never)
    .select(`
      category_id,
      category_name,
      parent_category_name,
      budget_bucket,
      avg_monthly_amount_12m,
      median_monthly_amount_12m,
      max_monthly_amount_12m,
      active_months_count,
      months_analyzed
    `)

  if (error) throw new Error(`rolling stats query failed: ${error.message}`)
  return (data ?? []) as CategoryRolling12mStats[]
}
