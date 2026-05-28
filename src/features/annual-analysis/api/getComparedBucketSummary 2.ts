import { budgetDb } from '@/lib/supabaseBudget'
import type { YtdBucketRow } from '@/features/annual-analysis/types.compared'
import { COMPARED_MONTHS, COMPARED_YEARS } from '@/features/annual-analysis/types.compared'

/**
 * Budget vs réel par bucket pour Jan-Avr 2025 et 2026.
 * Source : budget_bucket_budget_vs_actual_by_month.
 * delta_budget_bucket_eur et consumption_ratio sont précalculés par la vue.
 */
export async function getComparedBucketSummary(): Promise<YtdBucketRow[]> {
  const { data, error } = await budgetDb
    .from('budget_bucket_budget_vs_actual_by_month')
    .select(
      'period_year, period_month, budget_bucket, target_budget_bucket_eur, actual_budget_bucket_eur, delta_budget_bucket_eur, consumption_ratio',
    )
    .in('period_year', [...COMPARED_YEARS])
    .in('period_month', [...COMPARED_MONTHS])
    .order('period_year', { ascending: true })
    .order('period_month', { ascending: true })
    .order('budget_bucket', { ascending: true })

  if (error) throw new Error(`getComparedBucketSummary: ${error.message}`)

  return (data ?? []).map((row) => ({
    period_year:              Number(row.period_year),
    period_month:             Number(row.period_month),
    budget_bucket:            String(row.budget_bucket ?? ''),
    target_budget_bucket_eur: Number(row.target_budget_bucket_eur ?? 0),
    actual_budget_bucket_eur: Number(row.actual_budget_bucket_eur ?? 0),
    delta_budget_bucket_eur:  Number(row.delta_budget_bucket_eur ?? 0),
    consumption_ratio:        Number(row.consumption_ratio ?? 0),
  }))
}
