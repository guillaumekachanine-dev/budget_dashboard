import { useMutation, useQueryClient } from '@tanstack/react-query'
import { budgetDb } from '@/lib/supabaseBudget'
import { QK } from '@/lib/queryKeys'

export function useUpdateTripBudget() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ tripId, plannedBudget }: { tripId: string; plannedBudget: number }) => {
      if (plannedBudget < 0) throw new Error('Le budget ne peut pas être négatif.')
      const { error } = await budgetDb
        .from('trips')
        .update({ planned_budget: plannedBudget })
        .eq('id', tripId)
      if (error) throw new Error(error.message)
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [QK.TRIP_COCKPIT] })
    },
  })
}
