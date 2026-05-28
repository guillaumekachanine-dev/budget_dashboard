import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@/hooks/useAuth'
import { budgetDb } from '@/lib/supabaseBudget'
import { QK, STALE } from '@/lib/queryKeys'

export type TrajectoryPlannedOperationRow = {
  id: string
  label: string
  planned_date: string
  planned_personal_amount: number
  flow_type: string | null
  budget_impact: string | null
  category_name: string | null
  planned_status: 'done' | 'upcoming' | null
}

function toMonthBounds(year: number, month: number) {
  const monthStart = `${year}-${String(month).padStart(2, '0')}-01`
  const lastDay = new Date(year, month, 0).getDate()
  const monthEnd = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`
  return { monthStart, monthEnd }
}

export function useTrajectoryPlannedOperations(year: number, month: number) {
  const { user } = useAuth()
  const { monthStart, monthEnd } = toMonthBounds(year, month)

  return useQuery<TrajectoryPlannedOperationRow[]>({
    queryKey: [QK.PLANNED_OPERATIONS, 'trajectory', year, month],
    enabled: Boolean(user?.id),
    staleTime: STALE.ANALYTICS,
    queryFn: async () => {
      const { data, error } = await budgetDb
        .from('v_planned_operations_occurrences_enriched')
        .select(
          `
          id,
          label,
          planned_date,
          planned_personal_amount,
          flow_type,
          budget_impact,
          category_name,
          planned_status
        `,
        )
        .eq('user_id', user?.id as string)
        .gte('planned_date', monthStart)
        .lte('planned_date', monthEnd)
        .order('planned_date', { ascending: true })

      if (error) throw error

      return (data ?? [])
        .filter((row) => Boolean(row.id && row.planned_date))
        .map((row) => ({
          id: String(row.id),
          label: String(row.label ?? 'Opération planifiée'),
          planned_date: String(row.planned_date).slice(0, 10),
          planned_personal_amount: Number(row.planned_personal_amount ?? 0),
          flow_type: (row.flow_type as string | null) ?? null,
          budget_impact: (row.budget_impact as string | null) ?? null,
          category_name: (row.category_name as string | null) ?? null,
          planned_status: (row.planned_status as 'done' | 'upcoming' | null) ?? null,
        }))
    },
  })
}

