import { QK, STALE } from '@/lib/queryKeys'
import { useQuery } from '@tanstack/react-query'
import { getSavingsAnnualPerformance } from '@/features/savings/api/getSavingsAnnualPerformance'
import type { SavingsAnnualPerformanceRow } from '@/features/savings/types'

export function useSavingsAnnualPerformance() {
  const query = useQuery<SavingsAnnualPerformanceRow[], Error>({
    queryKey: [QK.SAVINGS_ANNUAL_PERFORMANCE],
    queryFn: getSavingsAnnualPerformance,
    staleTime: STALE.ANALYTICS,
  })

  return {
    data: query.data ?? [],
    isLoading: query.isLoading,
    error: query.error ?? null,
  }
}
