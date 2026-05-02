import { budgetDb } from '@/lib/supabaseBudget'
import type { Annual2025YearlyCategoryRow } from '@/features/annual-analysis/types'

export async function getAnnual2025YearlyParentCategories(): Promise<Annual2025YearlyCategoryRow[]> {
  const { data, error } = await budgetDb()
    .from('analytics_2025_yearly_category_summary')
    .select('category_name, category_level, amount_total_year, share_of_year_expense_pct, rank_in_year, analysis_year')
    .eq('analysis_year', 2025)
    .eq('category_level', 'parent')
    .order('rank_in_year', { ascending: true })

  if (error) {
    throw new Error(`getAnnual2025YearlyParentCategories failed: ${error.message}`)
  }

  return (data ?? []) as unknown as Annual2025YearlyCategoryRow[]
}
