import { budgetDb } from '@/lib/supabaseBudget'
import type { YtdCategoryRow } from '@/features/annual-analysis/types.compared'
import { COMPARED_MONTHS, COMPARED_YEARS } from '@/features/annual-analysis/types.compared'

/**
 * Dépenses par catégorie pour Jan-Avr 2025 et 2026.
 * Source : v_monthly_category_actuals_clean (live, expense buckets uniquement).
 */
export async function getComparedCategorySummary(): Promise<YtdCategoryRow[]> {
  const { data, error } = await budgetDb
    .from('v_monthly_category_actuals_clean' as never)
    .select(
      'period_year, period_month, category_name, parent_category_name, budget_behavior, actual_amount',
    )
    .in('period_year', [...COMPARED_YEARS])
    .in('period_month', [...COMPARED_MONTHS])
    .order('period_year', { ascending: true })
    .order('period_month', { ascending: true })

  if (error) throw new Error(`getComparedCategorySummary: ${error.message}`)

  return (data ?? []).map((row) => {
    const r = row as Record<string, unknown>
    return {
      period_year:          Number(r.period_year),
      period_month:         Number(r.period_month),
      category_name:        String(r.category_name ?? ''),
      parent_category_name: r.parent_category_name ? String(r.parent_category_name) : null,
      flow_type:            'expense',
      budget_behavior:      String(r.budget_behavior ?? ''),
      amount_total:         Number(r.actual_amount ?? 0),
    }
  })
}
