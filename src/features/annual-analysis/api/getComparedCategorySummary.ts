import { budgetDb } from '@/lib/supabaseBudget'
import type { YtdCategoryRow } from '@/features/annual-analysis/types.compared'
import { COMPARED_MONTHS, COMPARED_YEARS } from '@/features/annual-analysis/types.compared'

/**
 * Dépenses par catégorie pour Jan-Avr 2025 et 2026.
 * Source : analytics_monthly_category_metrics.
 * On ne sélectionne que flow_type = 'expense' pour la comparaison de dépenses.
 */
export async function getComparedCategorySummary(): Promise<YtdCategoryRow[]> {
  const { data, error } = await budgetDb
    .from('analytics_monthly_category_metrics')
    .select(
      'period_year, period_month, category_name, parent_category_name, flow_type, budget_behavior, amount_total',
    )
    .in('period_year', [...COMPARED_YEARS])
    .in('period_month', [...COMPARED_MONTHS])
    .eq('flow_type', 'expense')
    .order('period_year', { ascending: true })
    .order('period_month', { ascending: true })

  if (error) throw new Error(`getComparedCategorySummary: ${error.message}`)

  return (data ?? []).map((row) => ({
    period_year:          Number(row.period_year),
    period_month:         Number(row.period_month),
    category_name:        String(row.category_name ?? ''),
    parent_category_name: row.parent_category_name ? String(row.parent_category_name) : null,
    flow_type:            String(row.flow_type ?? ''),
    budget_behavior:      String(row.budget_behavior ?? ''),
    amount_total:         Number(row.amount_total ?? 0),
  }))
}
