import { budgetDb } from '@/lib/supabaseBudget'
import type { TripExpenseRow } from '../types'

function n(v: unknown, fallback = 0): number {
  return v == null ? fallback : Number(v)
}

function coerce(raw: Record<string, unknown>): TripExpenseRow {
  return {
    source_type:          raw.source_type as 'bank' | 'manual',
    source_id:            raw.source_id as string,
    trip_id:              raw.trip_id as string,
    user_id:              raw.user_id as string,
    expense_date:         raw.expense_date as string,
    amount:               n(raw.amount),
    personal_amount:      n(raw.personal_amount),
    personal_share_ratio: n(raw.personal_share_ratio, 1),
    category_id:          (raw.category_id as string | null) ?? null,
    category_name:        (raw.category_name as string | null) ?? null,
    parent_category_id:   (raw.parent_category_id as string | null) ?? null,
    parent_category_name: (raw.parent_category_name as string | null) ?? null,
    label:                (raw.label as string) ?? '',
    notes:                (raw.notes as string | null) ?? null,
    manual_expense_id:    (raw.manual_expense_id as string | null) ?? null,
    is_recurring:         Boolean(raw.is_recurring),
    account_id:           (raw.account_id as string | null) ?? null,
  }
}

export async function getTripExpenses(tripId: string): Promise<TripExpenseRow[]> {
  const { data, error } = await budgetDb
    .from('v_trip_expenses_unified')
    .select('*')
    .eq('trip_id', tripId)
    .order('expense_date', { ascending: false })

  if (error) throw new Error(`getTripExpenses: ${error.message}`)
  return (data ?? []).map((row) => coerce(row as Record<string, unknown>))
}
