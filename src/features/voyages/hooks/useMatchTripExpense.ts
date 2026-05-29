import { useMutation, useQueryClient } from '@tanstack/react-query'
import { budgetDb } from '@/lib/supabaseBudget'
import { QK } from '@/lib/queryKeys'

// ─── Rapprocher ───────────────────────────────────────────────────────────────

export interface MatchExpensePayload {
  /** id de trip_manual_expenses */
  manualExpenseId: string
  /** id de transactions (candidate bancaire) */
  transactionId:   string
  /** trip_id pour écrire sur la transaction bancaire */
  tripId:          string
}

/**
 * Rapprochement atomique (Promise.all) :
 *   1. trip_manual_expenses → status='matched', matched_transaction_id=transactionId
 *   2. transactions         → trip_id=tripId
 *
 * Garantit qu'une dépense matched n'est jamais recomptée :
 *   v_trip_expenses_unified exclut les manuelles matched,
 *   et compte la transaction bancaire via trip_id.
 */
export function useMatchTripExpense() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (payload: MatchExpensePayload) => {
      const [manualRes, txRes] = await Promise.all([
        budgetDb
          .from('trip_manual_expenses')
          .update({
            status:                  'matched',
            matched_transaction_id:  payload.transactionId,
          })
          .eq('id', payload.manualExpenseId),

        budgetDb
          .from('transactions')
          .update({ trip_id: payload.tripId })
          .eq('id', payload.transactionId),
      ])

      if (manualRes.error) throw new Error(`match.manual: ${manualRes.error.message}`)
      if (txRes.error)     throw new Error(`match.tx: ${txRes.error.message}`)
    },
    onSuccess: () => {
      invalidateAll(queryClient)
    },
  })
}

// ─── Ignorer (dismiss) ────────────────────────────────────────────────────────

export interface DismissExpensePayload {
  manualExpenseId: string
}

/**
 * Ignore la dépense manuelle : status='dismissed'.
 * La dépense est exclue de v_trip_expenses_unified et du cockpit.
 * La transaction bancaire correspondante n'est PAS modifiée.
 */
export function useDismissTripExpense() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (payload: DismissExpensePayload) => {
      const { error } = await budgetDb
        .from('trip_manual_expenses')
        .update({ status: 'dismissed' })
        .eq('id', payload.manualExpenseId)

      if (error) throw new Error(`dismiss.manual: ${error.message}`)
    },
    onSuccess: () => {
      invalidateAll(queryClient)
    },
  })
}

// ─── Invalidations partagées ──────────────────────────────────────────────────

function invalidateAll(queryClient: ReturnType<typeof useQueryClient>) {
  // Cockpit Home (total_actual change : pending retiré ou confirmé par tx)
  void queryClient.invalidateQueries({ queryKey: [QK.TRIP_COCKPIT] })
  // Candidats (la vue se rafraîchit : le candidat disparaît)
  void queryClient.invalidateQueries({ queryKey: [QK.TRIP_MATCH_CANDIDATES] })
  // Liste des dépenses manuelles
  void queryClient.invalidateQueries({ queryKey: [QK.TRIP_MANUAL_EXPENSES] })
  // Données annuelles voyage (useVoyagesData)
  void queryClient.invalidateQueries({ queryKey: [QK.VOYAGES] })
  void queryClient.invalidateQueries({ queryKey: [QK.VOYAGES_TRANSACTIONS] })
  // Transactions (trip_id peut avoir changé)
  void queryClient.invalidateQueries({ queryKey: [QK.TRANSACTIONS] })
}
