import { budgetDb } from '@/lib/supabaseBudget'
import type { SavingsAnnualPerformanceRow } from '@/features/savings/types'

function asNullableNumber(value: unknown): number | null {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

export async function getSavingsAnnualPerformance(): Promise<SavingsAnnualPerformanceRow[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (budgetDb as any)
    .from('v_savings_annual_performance')
    .select('*')
    .order('period_year', { ascending: true })

  if (error) {
    throw new Error(`getSavingsAnnualPerformance failed: ${error.message}`)
  }

  if (!data) return []

  return (data as Record<string, unknown>[]).map((row) => ({
    user_id: String(row.user_id ?? ''),
    account_id: String(row.account_id ?? ''),
    display_name: row.display_name != null ? String(row.display_name) : null,
    display_order: asNullableNumber(row.display_order),
    savings_family: row.savings_family != null ? String(row.savings_family) : null,
    savings_kind: row.savings_kind != null ? String(row.savings_kind) : null,
    period_year: asNullableNumber(row.period_year),
    balance_boy: asNullableNumber(row.balance_boy),
    balance_eoy: asNullableNumber(row.balance_eoy),
    total_versed_eur: asNullableNumber(row.total_versed_eur),
    operations_count: asNullableNumber(row.operations_count),
    performance_amount: asNullableNumber(row.performance_amount),
    performance_pct: asNullableNumber(row.performance_pct),
    regulated_rate_pct: asNullableNumber(row.regulated_rate_pct),
    regulated_interest_theoretical: asNullableNumber(row.regulated_interest_theoretical),
    latest_snapshot_date: row.latest_snapshot_date != null ? String(row.latest_snapshot_date) : null,
  }))
}
