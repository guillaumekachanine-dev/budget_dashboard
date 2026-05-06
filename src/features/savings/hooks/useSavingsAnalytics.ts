import { useQuery } from '@tanstack/react-query'
import { getSavingsAnalytics } from '@/features/savings/api/getSavingsAnalytics'
import type { SavingsAnalyticsData } from '@/features/savings/types'

export function useSavingsAnalytics(year: number) {
  const query = useQuery<SavingsAnalyticsData, Error>({
    queryKey: ['savings', 'analytics', year],
    queryFn: () => getSavingsAnalytics(year),
    staleTime: 60_000,
  })

  return {
    data: query.data ?? null,
    isLoading: query.isLoading,
    error: query.error ?? null,
  }
}
