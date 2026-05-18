import { useQuery } from '@tanstack/react-query'
import { getCategoryRolling12mStats } from '@/features/budget/api/getCategoryRolling12mStats'

export function useCategoryRolling12mStats(enabled = true) {
  return useQuery({
    queryKey: ['category-rolling-12m-stats'],
    queryFn: getCategoryRolling12mStats,
    staleTime: 5 * 60_000,
    enabled,
  })
}
