import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@/hooks/useAuth'
import { QK } from '@/lib/queryKeys'
import { getBudgetPagePayload } from '@/features/budget/api/getBudgetPagePayload'

interface UseBudgetPagePayloadParams {
  periodYear: number
  periodMonth: number
  monthsBack?: number
}

export function useBudgetPagePayload({ periodYear, periodMonth, monthsBack = 6 }: UseBudgetPagePayloadParams) {
  const { user } = useAuth()
  const userId = user?.id ?? null

  return useQuery({
    queryKey: [QK.BUDGET_PAYLOAD, userId, periodYear, periodMonth, monthsBack],
    queryFn: () => getBudgetPagePayload({ userId: userId!, periodYear, periodMonth, monthsBack }),
    enabled: !!userId,
    staleTime: 5 * 60_000,
  })
}
