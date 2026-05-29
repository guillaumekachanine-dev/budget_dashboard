import { budgetDb } from '@/lib/supabaseBudget'
import type { MatchCandidateRow } from '../types'

function n(v: unknown, fallback = 0): number {
  return v == null ? fallback : Number(v)
}

function coerce(raw: Record<string, unknown>): MatchCandidateRow {
  return {
    manual_expense_id:    raw.manual_expense_id as string,
    trip_id:              raw.trip_id as string,
    user_id:              raw.user_id as string,
    expense_date:         raw.expense_date as string,
    manual_amount:        n(raw.manual_amount),
    manual_label:         raw.manual_label as string,
    manual_category_id:   (raw.manual_category_id as string | null) ?? null,
    manual_category_name: (raw.manual_category_name as string | null) ?? null,
    candidate_tx_id:      raw.candidate_tx_id as string,
    tx_date:              raw.tx_date as string,
    tx_amount:            n(raw.tx_amount),
    tx_label:             (raw.tx_label as string | null) ?? null,
    tx_merchant:          (raw.tx_merchant as string | null) ?? null,
    tx_category_id:       (raw.tx_category_id as string | null) ?? null,
    tx_category_name:     (raw.tx_category_name as string | null) ?? null,
    amount_delta_pct:     n(raw.amount_delta_pct),
    date_delta_days:      n(raw.date_delta_days),
    category_match:       Boolean(raw.category_match),
    confidence_score:     n(raw.confidence_score),
  }
}

/**
 * Retourne les candidats de rapprochement depuis v_trip_match_candidates.
 * Si tripId est fourni, filtre sur les dépenses manuelles de ce voyage.
 * Triés par confidence_score DESC.
 */
export async function getMatchCandidates(tripId?: string): Promise<MatchCandidateRow[]> {
  let query = budgetDb
    .from('v_trip_match_candidates')
    .select('*')
    .order('confidence_score', { ascending: false })

  if (tripId) {
    query = query.eq('trip_id', tripId)
  }

  const { data, error } = await query
  if (error) throw new Error(`getMatchCandidates: ${error.message}`)
  return (data ?? []).map((row) => coerce(row as Record<string, unknown>))
}
