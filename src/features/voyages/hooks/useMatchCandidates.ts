import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'
import { QK, STALE } from '@/lib/queryKeys'
import { getMatchCandidates } from '../api/getMatchCandidates'
import type { MatchGroup } from '../types'

/**
 * Charge les candidats de rapprochement et les groupe par dépense manuelle.
 * Si tripId est fourni, filtre sur ce voyage uniquement.
 */
export function useMatchCandidates(tripId?: string) {
  const query = useQuery({
    queryKey:  [QK.TRIP_MATCH_CANDIDATES, tripId ?? null],
    queryFn:   () => getMatchCandidates(tripId),
    staleTime: STALE.LIVE,   // live : les rapprochements changent fréquemment
  })

  const rows = useMemo(() => query.data ?? [], [query.data])

  // Grouper par manual_expense_id, conserver l'ordre confidence_score DESC des candidats
  const groups = useMemo<MatchGroup[]>(() => {
    const map = new Map<string, MatchGroup>()

    for (const row of rows) {
      const existing = map.get(row.manual_expense_id)
      if (existing) {
        existing.candidates.push(row)
      } else {
        map.set(row.manual_expense_id, {
          manualExpenseId:    row.manual_expense_id,
          tripId:             row.trip_id,
          expenseDate:        row.expense_date,
          manualAmount:       row.manual_amount,
          manualLabel:        row.manual_label,
          manualCategoryId:   row.manual_category_id,
          manualCategoryName: row.manual_category_name,
          candidates:         [row],
        })
      }
    }

    // Trier les groupes : plus grand confidence_score du premier candidat en tête
    return [...map.values()].sort(
      (a, b) => (b.candidates[0]?.confidence_score ?? 0) - (a.candidates[0]?.confidence_score ?? 0),
    )
  }, [rows])

  return {
    groups,
    totalPending:  groups.length,
    isLoading:     query.isLoading,
    error:         query.error ?? null,
    refetch:       query.refetch,
  }
}
