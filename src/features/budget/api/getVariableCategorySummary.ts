import { budgetDb } from '@/lib/supabaseBudget'
import type { AnalyticsVariableCategorySummary } from '@/lib/types'

const VARIABLE_CATEGORY_SUMMARY_COLUMNS = [
  'category_id',
  'category_name',
  'parent_category_id',
  'parent_category_name',
  'category_path',
  'active_months_count',
  'avg_monthly_amount',
  'median_monthly_amount',
  'min_monthly_amount',
  'max_monthly_amount',
  'total_amount',
  'refreshed_at',
].join(', ')

export async function getVariableCategorySummary(): Promise<AnalyticsVariableCategorySummary[]> {
  const { data, error } = await budgetDb()
    .from('analytics_variable_category_summary')
    .select(VARIABLE_CATEGORY_SUMMARY_COLUMNS)
    .order('total_amount', { ascending: false })

  if (error) {
    throw new Error(`getVariableCategorySummary failed: ${error.message}`)
  }

  return (data ?? []) as unknown as AnalyticsVariableCategorySummary[]
}
