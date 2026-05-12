import { useQuery } from '@tanstack/react-query'
import {
  getMonthlyFlowsByScope,
  type MonthlyFlowsScopeResult,
} from '@/features/budget/api/getMonthlyFlowsByScope'
import type { MetricsScopeSelection } from '@/features/annual-analysis/components/Annual2026BlockMetrics'

const ALL_CATEGORIES_ID = 'all_categories'

export function useMonthlyFlowsByScope(
  scopeSelection: MetricsScopeSelection | undefined,
  year: number,
  enabled = true,
): { data: MonthlyFlowsScopeResult | null; isLoading: boolean } {
  const isAllCategories =
    !scopeSelection ||
    (scopeSelection.kind === 'categorie' && scopeSelection.id === ALL_CATEGORIES_ID)

  const { data, isLoading } = useQuery({
    queryKey: ['monthly-flows-by-scope', year, scopeSelection?.kind, scopeSelection?.id],
    enabled: enabled && !isAllCategories,
    staleTime: 5 * 60_000,
    queryFn: () =>
      getMonthlyFlowsByScope({
        kind: scopeSelection!.kind as 'categorie' | 'bloc',
        id: scopeSelection!.id,
        year,
      }),
  })

  return { data: data ?? null, isLoading }
}
