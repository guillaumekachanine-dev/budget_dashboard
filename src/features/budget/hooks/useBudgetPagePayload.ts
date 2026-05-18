import { useQuery } from '@tanstack/react-query'
import { getBudgetPagePayload } from '@/features/budget/api/getBudgetPagePayload'

interface UseBudgetPagePayloadParams {
  periodYear: number
  periodMonth: number
  monthsBack?: number
}

export function useBudgetPagePayload({ periodYear, periodMonth, monthsBack = 6 }: UseBudgetPagePayloadParams) {
  return useQuery({
    queryKey: ['budget-payload', periodYear, periodMonth, monthsBack],
    queryFn: () => getBudgetPagePayload({ periodYear, periodMonth, monthsBack }),
    staleTime: 5 * 60_000,
  })
}
