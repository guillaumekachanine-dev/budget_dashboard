import { useQuery } from '@tanstack/react-query'
import { getOptimizationCapacityPayload } from '@/features/stats/api/getOptimizationCapacityPayload'
import type { OptimizationCapacityPayload } from '@/features/stats/types'

export function useOptimizationCapacity(year: number) {
  const query = useQuery<OptimizationCapacityPayload | null, Error>({
    queryKey: ['stats', 'optimization-capacity', year],
    queryFn: () => getOptimizationCapacityPayload(year),
    staleTime: 60_000,
  })

  return {
    data: query.data ?? null,
    isLoading: query.isLoading,
    error: query.error ?? null,
  }
}
