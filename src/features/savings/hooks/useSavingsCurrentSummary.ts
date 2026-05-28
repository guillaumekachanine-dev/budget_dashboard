import { QK, STALE } from '@/lib/queryKeys'
import { useQuery } from '@tanstack/react-query'
import { getSavingsCurrentSummary } from '@/features/savings/api/getSavingsCurrentSummary'
import type { SavingsCurrentSummary } from '@/features/savings/types'

export function useSavingsCurrentSummary() {
  const query = useQuery<SavingsCurrentSummary | null, Error>({
    queryKey: [QK.SAVINGS_CURRENT_SUMMARY],
    queryFn: getSavingsCurrentSummary,
    staleTime: STALE.ANALYTICS,
  })

  return {
    data: query.data ?? null,
    isLoading: query.isLoading,
    error: query.error ?? null,
  }
}
