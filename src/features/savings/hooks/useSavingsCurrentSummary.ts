import { useQuery } from '@tanstack/react-query'
import { getSavingsCurrentSummary } from '@/features/savings/api/getSavingsCurrentSummary'
import type { SavingsCurrentSummary } from '@/features/savings/types'

export function useSavingsCurrentSummary() {
  const query = useQuery<SavingsCurrentSummary | null, Error>({
    queryKey: ['savings', 'current-summary'],
    queryFn: getSavingsCurrentSummary,
    staleTime: 60_000,
  })

  return {
    data: query.data ?? null,
    isLoading: query.isLoading,
    error: query.error ?? null,
  }
}
