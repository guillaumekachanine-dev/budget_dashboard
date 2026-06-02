import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@/hooks/useAuth'
import { QK, STALE } from '@/lib/queryKeys'
import { budgetDb } from '@/lib/supabaseBudget'
import { getCurrentPeriod } from '@/lib/utils'

type CurrentMonthSavingsPlanning = {
  plannedSavingsAmount: number
  transferAmount: number
  effectivePlannedSavingsAmount: number
  transferDate: string | null
}

function toFiniteNumber(value: unknown): number {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

export function useCurrentMonthSavingsPlanning(periodYear?: number, periodMonth?: number) {
  const { user } = useAuth()
  const userId = user?.id ?? null
  const { year: defaultYear, month: defaultMonth } = getCurrentPeriod()
  const targetYear = periodYear ?? defaultYear
  const targetMonth = periodMonth ?? defaultMonth

  return useQuery<CurrentMonthSavingsPlanning | null>({
    queryKey: [QK.SAVINGS, 'current-month-planning', userId, targetYear, targetMonth],
    enabled: Boolean(userId),
    staleTime: STALE.LIVE,
    queryFn: async () => {
      const { data, error } = await budgetDb
        .from('savings_planning_month_details' as never)
        .select('planned_savings_amount,transfer_amount,transfer_date')
        .eq('user_id', userId as string)
        .eq('period_year', targetYear)
        .eq('period_month', targetMonth)
        .maybeSingle()

      if (error) throw error
      if (!data) return null

      const row = data as Record<string, unknown>
      const plannedSavingsAmount = toFiniteNumber(row.planned_savings_amount)
      const transferAmount = toFiniteNumber(row.transfer_amount)
      const effectivePlannedSavingsAmount = plannedSavingsAmount > 0 ? plannedSavingsAmount : transferAmount

      return {
        plannedSavingsAmount,
        transferAmount,
        effectivePlannedSavingsAmount,
        transferDate: typeof row.transfer_date === 'string' ? row.transfer_date : null,
      }
    },
  })
}
