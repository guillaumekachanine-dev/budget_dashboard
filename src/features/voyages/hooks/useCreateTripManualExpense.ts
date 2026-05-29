import { useMutation, useQueryClient } from '@tanstack/react-query'
import { budgetDb } from '@/lib/supabaseBudget'
import { useAuth } from '@/hooks/useAuth'
import { QK } from '@/lib/queryKeys'

export interface CreateTripManualExpensePayload {
  tripId: string
  categoryId: string | null
  date: string          // 'YYYY-MM-DD'
  amount: number        // positif, en EUR
  label: string
  notes: string | null
  imputationType: 'personal' | 'joint'
  personalShareRatio: number
}

export function useCreateTripManualExpense() {
  const queryClient = useQueryClient()
  const { user } = useAuth()

  return useMutation({
    mutationFn: async (payload: CreateTripManualExpensePayload) => {
      if (!user) throw new Error('Non authentifié')
      if (payload.amount <= 0) throw new Error('Le montant doit être positif')
      if (!payload.label.trim()) throw new Error('Le libellé est requis')

      const { data, error } = await budgetDb
          .from('trip_manual_expenses')
          .insert({
            user_id:    user.id,
            trip_id:    payload.tripId,
            category_id: payload.categoryId || null,
            expense_date: payload.date,
            amount:     payload.amount,
            label:      payload.label.trim(),
            notes:      payload.notes?.trim() || null,
            status:     'pending',
            matched_transaction_id: null,
            imputation_type: payload.imputationType,
            personal_share_ratio: payload.personalShareRatio,
          })
          .select()
          .single()

      if (error) throw new Error(error.message)
      return data
    },
    onSuccess: () => {
      // Cockpit Home reflète le nouveau total (pending compte dans total_actual)
      void queryClient.invalidateQueries({ queryKey: [QK.TRIP_COCKPIT] })
      // Dépenses annuelles et transactions voyage
      void queryClient.invalidateQueries({ queryKey: [QK.VOYAGES] })
      void queryClient.invalidateQueries({ queryKey: [QK.VOYAGES_TRANSACTIONS] })
      // Liste des dépenses manuelles (usages futurs)
      void queryClient.invalidateQueries({ queryKey: [QK.TRIP_MANUAL_EXPENSES] })
    },
  })
}
