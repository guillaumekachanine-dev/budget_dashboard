import { budgetDb } from '@/lib/supabaseBudget'
import { COMPARED_MONTHS, COMPARED_YEARS } from '@/features/annual-analysis/types.compared'

export interface BucketCategoryBreakdownRow {
  category_id:          string | null
  category_name:        string
  parent_category_name: string | null
  amount_2025:          number
  amount_2026:          number
}

/**
 * Dépenses YTD par sous-catégorie pour un bloc donné (Jan-Avr 2025+2026).
 * Jointure client-side : category_budget_bucket_map → analytics_monthly_category_metrics.
 */
export async function getComparedBucketCategoryBreakdown(
  bucket: string,
): Promise<BucketCategoryBreakdownRow[]> {
  // ① Récupérer les category_id appartenant au bloc
  const { data: mapData, error: mapError } = await budgetDb
    .from('category_budget_bucket_map')
    .select('category_id')
    .eq('budget_bucket', bucket)

  if (mapError) throw new Error(`getComparedBucketCategoryBreakdown (map): ${mapError.message}`)

  const categoryIds = (mapData ?? [])
    .map((r) => (r as { category_id: string }).category_id)
    .filter(Boolean)

  if (categoryIds.length === 0) return []

  // ② Récupérer les montants YTD pour ces catégories
  const { data, error } = await budgetDb
    .from('v_monthly_category_actuals_clean' as never)
    .select('period_year, category_id, category_name, parent_category_name, actual_amount')
    .in('period_year', [...COMPARED_YEARS])
    .in('period_month', [...COMPARED_MONTHS])
    .in('category_id', categoryIds)

  if (error) throw new Error(`getComparedBucketCategoryBreakdown (metrics): ${error.message}`)

  // ③ Agréger par (parent_category_name, category_name) et année
  const map = new Map<string, BucketCategoryBreakdownRow>()

  const rows = (data ?? []) as Array<Record<string, unknown>>
  for (const row of rows) {
    const catId      = row.category_id ? String(row.category_id) : null
    const catName    = String(row.category_name ?? '')
    const parentName = row.parent_category_name ? String(row.parent_category_name) : null
    const key        = `${catId ?? ''}__${parentName ?? ''}__${catName}`
    const amount     = Number(row.actual_amount ?? 0)

    const entry = map.get(key) ?? { category_id: catId, category_name: catName, parent_category_name: parentName, amount_2025: 0, amount_2026: 0 }
    if (Number(row.period_year) === 2025) entry.amount_2025 += amount
    if (Number(row.period_year) === 2026) entry.amount_2026 += amount
    map.set(key, entry)
  }

  // Tri décroissant sur 2026 (ou 2025 si pas de données 2026)
  return [...map.values()].sort((a, b) => (b.amount_2026 || b.amount_2025) - (a.amount_2026 || a.amount_2025))
}
