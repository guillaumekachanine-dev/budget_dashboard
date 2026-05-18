import { useQuery } from '@tanstack/react-query'
import type { MetricsScopeSelection } from '@/features/annual-analysis/components/Annual2026BlockMetrics'
import {
  getCategoryAnnualCostProjection2026,
  type CategoryAnnualCostProjection2026,
  type CategoryAnnualCostProjectionScope,
} from '@/features/annual-analysis/api/getCategoryAnnualCostProjection2026'

export function useCategoryAnnualCostProjection2026(
  scopeSelection: MetricsScopeSelection | undefined,
  year = 2026,
): { data: CategoryAnnualCostProjection2026[]; isLoading: boolean } {
  const scope: CategoryAnnualCostProjectionScope = scopeSelection
    ? { kind: scopeSelection.kind, id: scopeSelection.id }
    : undefined

  const { data, isLoading } = useQuery({
    queryKey: ['category-annual-cost-projection-2026', year, scope?.kind ?? 'all', scope?.id ?? 'all'],
    staleTime: 5 * 60_000,
    queryFn: () => getCategoryAnnualCostProjection2026(scope, year),
  })

  return { data: data ?? [], isLoading }
}
