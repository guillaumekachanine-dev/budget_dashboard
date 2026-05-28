import { useQuery } from '@tanstack/react-query'
import {
  getAnnualProjectionOverview2026,
  type AnnualProjectionOverview2026,
} from '@/features/annual-analysis/api/getAnnualProjectionOverview2026'

export function useAnnualProjectionOverview2026(
  year = 2026,
): { data: AnnualProjectionOverview2026 | null; isLoading: boolean } {
  const { data, isLoading } = useQuery({
    queryKey: ['annual-projection-overview-2026', year],
    staleTime: 5 * 60_000,
    queryFn: () => getAnnualProjectionOverview2026(year),
  })

  return {
    data: data ?? null,
    isLoading,
  }
}
