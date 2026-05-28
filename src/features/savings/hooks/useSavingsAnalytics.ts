import { QK, STALE } from '@/lib/queryKeys'
import { useQuery } from '@tanstack/react-query'
import { getSavingsAnalytics } from '@/features/savings/api/getSavingsAnalytics'
import type { SavingsAnalyticsData } from '@/features/savings/types'

export function useSavingsAnalytics(year: number) {
  const query = useQuery<SavingsAnalyticsData, Error>({
    queryKey: [QK.SAVINGS_ANALYTICS, year],
    queryFn: () => getSavingsAnalytics(year),
    staleTime: STALE.ANALYTICS,
  })

  return {
    data: query.data ?? null,
    isLoading: query.isLoading,
    error: query.error ?? null,
  }
}
