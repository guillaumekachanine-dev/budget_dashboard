import { budgetDb } from '@/lib/supabaseBudget'
import type { TripCockpitRow } from '@/lib/types'

// PostgREST retourne les colonnes Postgres `numeric` sous forme de string JSON.
// Cette fonction normalise chaque ligne vers les types TypeScript attendus.
function coerceRow(raw: Record<string, unknown>): TripCockpitRow {
  const n = (v: unknown, fallback = 0): number =>
    v == null ? fallback : Number(v)

  return {
    trip_id:              raw.trip_id as string,
    user_id:              raw.user_id as string,
    name:                 raw.name as string,
    emoji:                (raw.emoji as string | null) ?? null,
    start_date:           raw.start_date as string,
    end_date:             raw.end_date as string,
    year:                 n(raw.year),
    trip_notes:           (raw.trip_notes as string | null) ?? null,
    planned_budget:       raw.planned_budget != null ? n(raw.planned_budget) : null,
    total_bank:           n(raw.total_bank),
    total_manual_pending: n(raw.total_manual_pending),
    total_actual:         n(raw.total_actual),
    total_personal_actual:n(raw.total_personal_actual),
    remaining:            raw.remaining != null ? n(raw.remaining) : null,
    consumed_pct:         raw.consumed_pct != null ? n(raw.consumed_pct) : null,
    expense_count:        n(raw.expense_count),
    bank_expense_count:   n(raw.bank_expense_count),
    manual_pending_count: n(raw.manual_pending_count),
    has_pending_manual:   Boolean(raw.has_pending_manual),
    pending_match_count:  n(raw.pending_match_count),
    days_total:           n(raw.days_total),
    avg_per_day:          n(raw.avg_per_day),
    trip_status:          raw.trip_status as TripCockpitRow['trip_status'],
  }
}

export async function getTripCockpit(): Promise<TripCockpitRow[]> {
  const { data, error } = await budgetDb
    .from('v_trip_cockpit')
    .select('*')
    .order('start_date', { ascending: true })

  if (error) throw new Error(`getTripCockpit: ${error.message}`)
  return (data ?? []).map((row) => coerceRow(row as Record<string, unknown>))
}
