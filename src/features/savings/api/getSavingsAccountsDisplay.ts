import { budgetDb } from '@/lib/supabaseBudget'
import type { SavingsAccountDisplay } from '@/features/savings/types'

function asNullableNumber(value: unknown): number | null {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function asNullableBoolean(value: unknown): boolean | null {
  if (value === null || value === undefined) return null
  return Boolean(value)
}

export async function getSavingsAccountsDisplay(): Promise<SavingsAccountDisplay[]> {
  const { data, error } = await budgetDb
    .from('v_savings_accounts_display')
    .select('*')
    .order('display_order', { ascending: true })

  if (error) {
    console.error('[getSavingsAccountsDisplay] error:', error)
    throw new Error(`getSavingsAccountsDisplay failed: ${error.message}`)
  }

  if (!data) return []

  return (data as Record<string, unknown>[]).map((row) => ({
    config_id: String(row.config_id ?? ''),
    user_id: String(row.user_id ?? ''),
    account_id: String(row.account_id ?? ''),
    savings_family: row.savings_family != null ? String(row.savings_family) : null,
    savings_kind: row.savings_kind != null ? String(row.savings_kind) : null,
    display_name: row.display_name != null ? String(row.display_name) : null,
    display_order: asNullableNumber(row.display_order),
    is_liquid: asNullableBoolean(row.is_liquid),
    risk_level: (row.risk_level as SavingsAccountDisplay['risk_level']) ?? null,
    is_tax_advantaged: asNullableBoolean(row.is_tax_advantaged),
    is_locked: asNullableBoolean(row.is_locked),
    institution_name: row.institution_name != null ? String(row.institution_name) : null,
    currency: row.currency != null ? String(row.currency) : null,
    current_balance: asNullableNumber(row.current_balance),
    sub_accounts_count: asNullableNumber(row.sub_accounts_count),
    latest_balance_month: row.latest_balance_month != null ? String(row.latest_balance_month) : null,
    latest_observed_date: row.latest_observed_date != null ? String(row.latest_observed_date) : null,
  }))
}
