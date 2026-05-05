import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { budgetDb } from '@/lib/supabaseBudget'
import type { PlannedOperation, PlannedOperationInsert } from '@/lib/types'

export function usePlannedOperations(userId?: string) {
  return useQuery({
    queryKey: ['planned-operations', userId],
    enabled: Boolean(userId),
    queryFn: async (): Promise<PlannedOperation[]> => {
      const { data, error } = await budgetDb()
        .from('planned_operations')
        .select('*, category:categories(id,name,icon_key)')
        .eq('user_id', userId as string)
        .eq('status', 'planned')
        .order('planned_date', { ascending: true })
        .order('created_at', { ascending: false })

      if (error) throw error
      return data ?? []
    },
  })
}

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
      void queryClient.invalidateQueries({ queryKey: ['planned-operations'] })
    },
  })
}
