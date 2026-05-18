import { useQuery } from '@tanstack/react-query'
import { getInvestmentPerformancePayload } from '@/features/stats/api/getInvestmentPerformancePayload'
import type { InvestmentPerformancePayload } from '@/features/stats/types'

export function useInvestmentPerformance(year: number) {
  const query = useQuery<InvestmentPerformancePayload | null, Error>({
    queryKey: ['stats', 'investment-performance', year],
    queryFn: () => getInvestmentPerformancePayload(year),
    staleTime: 60_000,
  })

  return {
    data: query.data ?? null,
    isLoading: query.isLoading,
    error: query.error ?? null,
  }
}
