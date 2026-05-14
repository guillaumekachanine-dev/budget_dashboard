import { useQuery } from '@tanstack/react-query'
import { getSavingsEvolutionFiveYears } from '@/features/savings/api/getSavingsEvolutionFiveYears'
import type { SavingsEvolutionFiveYearsPayload } from '@/features/savings/types'

export function useSavingsEvolutionFiveYears() {
  const query = useQuery<SavingsEvolutionFiveYearsPayload, Error>({
    queryKey: ['savings', 'evolution-5y'],
    queryFn: getSavingsEvolutionFiveYears,
    staleTime: 60_000,
  })

  return {
    data: query.data ?? null,
    isLoading: query.isLoading,
    error: query.error ?? null,
  }
}
