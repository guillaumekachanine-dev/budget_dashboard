import { budgetDb } from '@/lib/supabaseBudget'
import type { Annual2025YearlyBucketRow } from '@/features/annual-analysis/types'

export async function getAnnual2025YearlyBuckets(): Promise<Annual2025YearlyBucketRow[]> {
  const { data, error } = await budgetDb()
    .from('analytics_2025_yearly_bucket_summary')
    .select('analysis_year, budget_bucket, amount_total_year, share_of_year_expense_pct, rank_in_year')
    .eq('analysis_year', 2025)
    .order('rank_in_year', { ascending: true })

  if (error) {
    throw new Error(`getAnnual2025YearlyBuckets failed: ${error.message}`)
  }

  return (data ?? []) as unknown as Annual2025YearlyBucketRow[]
}
