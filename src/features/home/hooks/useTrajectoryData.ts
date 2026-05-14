import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { budgetDb } from '@/lib/supabaseBudget'

export interface TrajectoryDay {
  day: number
  planned: number
  actual: number | null
  delta: number | null
}

export interface TrajectoryData {
  total_budget: number
  days_in_month: number
  days_elapsed: number
  days: TrajectoryDay[]
}

export function useTrajectoryData(year: number, month: number) {
  return useQuery<TrajectoryData | null>({
    queryKey: ['home', 'trajectory', year, month],
    queryFn: async () => {
      const { data: { user }, error: userError } = await supabase.auth.getUser()
      if (userError || !user) return null

      const { data, error } = await budgetDb.rpc('get_trajectory_data', {
        p_user_id: user.id,
        p_year:    year,
        p_month:   month,
      })
      if (error) throw error
      return data as unknown as TrajectoryData | null
    },
    staleTime: 60_000,
  })
}
