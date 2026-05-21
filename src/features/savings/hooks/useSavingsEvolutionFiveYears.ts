import { QK, STALE } from '@/lib/queryKeys'
import { useQuery } from '@tanstack/react-query'
import { getSavingsEvolutionFiveYears } from '@/features/savings/api/getSavingsEvolutionFiveYears'
import type { SavingsEvolutionFiveYearsPayload } from '@/features/savings/types'

export function useSavingsEvolutionFiveYears() {
  const query = useQuery<SavingsEvolutionFiveYearsPayload, Error>({
    queryKey: [QK.SAVINGS_EVOLUTION_5Y],
    queryFn: getSavingsEvolutionFiveYears,
    staleTime: STALE.ANALYTICS,
  })

  return {
    data: query.data ?? null,
    isLoading: query.isLoading,
    error: query.error ?? null,
  }
}
