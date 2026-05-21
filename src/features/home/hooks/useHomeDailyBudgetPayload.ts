import { QK } from '@/lib/queryKeys'
import { useQuery } from '@tanstack/react-query'
import { budgetDb } from '@/lib/supabaseBudget'
import { getCurrentPeriod } from '@/lib/utils'
import type { HomeDailyBudgetPayload } from '../types'

export function useHomeDailyBudgetPayload(periodYear?: number, periodMonth?: number) {
  const { year: defaultYear, month: defaultMonth } = getCurrentPeriod()
  const targetYear = periodYear ?? defaultYear
  const targetMonth = periodMonth ?? defaultMonth

  return useQuery<HomeDailyBudgetPayload | null>({
    queryKey: [QK.HOME_DAILY_BUDGET, targetYear, targetMonth],
    queryFn: async () => {
      const { data: { user }, error: userError } = await budgetDb.auth.getUser()
      if (userError || !user) return null

      const { data, error } = await budgetDb.rpc('get_home_daily_budget_payload', {
        p_user_id: user.id,
        p_period_year: targetYear,
        p_period_month: targetMonth,
      })

      if (error) throw new Error(`useHomeDailyBudgetPayload: ${error.message}`)

      if (Array.isArray(data) && data.length > 0) return data[0] as unknown as HomeDailyBudgetPayload
      return data as unknown as HomeDailyBudgetPayload | null
    },
    staleTime: 60_000,
  })
}
