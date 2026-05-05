import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { getCurrentPeriod } from '@/lib/utils'
import type { HomeDailyBudgetPayload } from '../types'

export function useHomeDailyBudgetPayload(periodYear?: number, periodMonth?: number) {
  const { year: defaultYear, month: defaultMonth } = getCurrentPeriod()
  const targetYear = periodYear ?? defaultYear
  const targetMonth = periodMonth ?? defaultMonth

  return useQuery<HomeDailyBudgetPayload | null>({
    queryKey: ['home', 'daily-budget-payload', targetYear, targetMonth],
    queryFn: async () => {
      const { data: { user }, error: userError } = await supabase.auth.getUser()
      if (userError || !user) return null

      // RPC not yet in generated types — cast the schema client to any
      const db = supabase.schema('budget_dashboard') as any
      const { data, error } = await db.rpc('get_home_daily_budget_payload', {
        p_user_id: user.id,
        p_period_year: targetYear,
        p_period_month: targetMonth,
      })

      if (error) throw new Error(`useHomeDailyBudgetPayload: ${error.message}`)

      if (Array.isArray(data) && data.length > 0) return data[0] as HomeDailyBudgetPayload
      return data as HomeDailyBudgetPayload | null
    },
    staleTime: 60_000,
  })
}
