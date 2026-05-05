import { useMutation, useQueryClient } from '@tanstack/react-query'
import { budgetDb } from '@/lib/supabaseBudget'
import { hydrateStatsReferenceData } from '@/features/stats/store/statsReferenceStore'
import type { PlannedOperationInsert } from '@/lib/types'

export function useAddPlannedOperation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (plannedOperation: PlannedOperationInsert) => {
      const { data, error } = await budgetDb()
        .from('planned_operations')
        .insert(plannedOperation)
        .select()
        .single()

      if (error) throw error
      return data
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['transactions'] })
      void queryClient.invalidateQueries({ queryKey: ['home', 'daily-budget-payload'] })
      void queryClient.invalidateQueries({ queryKey: ['home'] })
      void hydrateStatsReferenceData({ force: true }).catch(() => {})
    },
  })
}
