import { useQuery } from '@tanstack/react-query'
import { getSavingsAnnualPerformance } from '@/features/savings/api/getSavingsAnnualPerformance'
import type { SavingsAnnualPerformanceRow } from '@/features/savings/types'

export function useSavingsAnnualPerformance() {
  const query = useQuery<SavingsAnnualPerformanceRow[], Error>({
    queryKey: ['savings', 'annual-performance'],
    queryFn: getSavingsAnnualPerformance,
    staleTime: 60_000,
  })

  return {
    data: query.data ?? [],
    isLoading: query.isLoading,
    error: query.error ?? null,
  }
}
