import { budgetDb } from '@/lib/supabaseBudget'
import type { Annual2025InsightRow } from '@/features/annual-analysis/types'

export async function getAnnual2025Insights(): Promise<Annual2025InsightRow[]> {
  const { data, error } = await budgetDb()
    .from('analytics_2025_insights')
    .select('insight_key, insight_level, value_text, value_numeric, payload')

  if (error) {
    throw new Error(`getAnnual2025Insights failed: ${error.message}`)
  }

  return (data ?? []) as unknown as Annual2025InsightRow[]
}
