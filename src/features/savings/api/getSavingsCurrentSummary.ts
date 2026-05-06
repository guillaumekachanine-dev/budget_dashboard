import { budgetDb } from '@/lib/supabaseBudget'
import type { SavingsCurrentSummary } from '@/features/savings/types'

function asNullableNumber(value: unknown): number | null {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

export async function getSavingsCurrentSummary(): Promise<SavingsCurrentSummary | null> {
  const { data, error } = await budgetDb()
    .from('v_savings_current_summary')
    .select(`
      total_savings,
      livrets_total,
      placements_total,
      liquid_savings_total,
      locked_savings_total,
      accounts_count,
      livrets_share_pct,
      placements_share_pct,
      liquid_share_pct,
      locked_share_pct
    `)
    .maybeSingle()

  if (error) {
    throw new Error(`getSavingsCurrentSummary failed: ${error.message}`)
  }

  if (!data) return null

  const row = data as Record<string, unknown>

  return {
    total_savings: asNullableNumber(row.total_savings),
    livrets_total: asNullableNumber(row.livrets_total),
    placements_total: asNullableNumber(row.placements_total),
    liquid_savings_total: asNullableNumber(row.liquid_savings_total),
    locked_savings_total: asNullableNumber(row.locked_savings_total),
    accounts_count: asNullableNumber(row.accounts_count),
    livrets_share_pct: asNullableNumber(row.livrets_share_pct),
    placements_share_pct: asNullableNumber(row.placements_share_pct),
    liquid_share_pct: asNullableNumber(row.liquid_share_pct),
    locked_share_pct: asNullableNumber(row.locked_share_pct),
  }
}
