import { useCallback, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/hooks/useAuth'
import { QK } from '@/lib/queryKeys'
import { getMonthlyMetrics } from '@/features/budget/api/getMonthlyMetrics'
import { getMonthlyVariableCategories } from '@/features/budget/api/getMonthlyVariableCategories'
import { getVariableCategorySummary } from '@/features/budget/api/getVariableCategorySummary'
import type {
  AnalyticsMonthlyCategoryMetrics,
  AnalyticsMonthlyMetrics,
  AnalyticsVariableCategorySummary,
} from '@/lib/types'

export type UseBudgetAnalyticsOptions = {
  year?: number
  autoRefresh?: boolean
  autoLoad?: boolean
}

export type UseBudgetAnalyticsResult = {
  loading: boolean
  refreshing: boolean
  error: string | null
  monthlyMetrics: AnalyticsMonthlyMetrics[]
  monthlyVariableCategories: AnalyticsMonthlyCategoryMetrics[]
  variableCategorySummary: AnalyticsVariableCategorySummary[]
  refreshedAt: string | null
  refreshAndReload: () => Promise<void>
  reloadOnly: () => Promise<void>
}

function pickLatestRefreshedAt(
  monthlyMetrics: AnalyticsMonthlyMetrics[],
  monthlyVariableCategories: AnalyticsMonthlyCategoryMetrics[],
  variableCategorySummary: AnalyticsVariableCategorySummary[],
): string | null {
  const allDates = [
    ...monthlyMetrics.map((r) => r.refreshed_at),
    ...monthlyVariableCategories.map((r) => r.refreshed_at),
    ...variableCategorySummary.map((r) => r.refreshed_at),
  ].filter(Boolean)

  if (!allDates.length) return null
  return allDates.sort((a, b) => b.localeCompare(a))[0] ?? null
}

async function fetchBudgetAnalyticsData(year: number | undefined) {
  const [metrics, variableCategories, categorySummary] = await Promise.all([
    getMonthlyMetrics(year),
    getMonthlyVariableCategories(year),
    getVariableCategorySummary(),
  ])
  return {
    monthlyMetrics: metrics,
    monthlyVariableCategories: variableCategories,
    variableCategorySummary: categorySummary,
    refreshedAt: pickLatestRefreshedAt(metrics, variableCategories, categorySummary),
  }
}

export function useBudgetAnalytics(options: UseBudgetAnalyticsOptions = {}): UseBudgetAnalyticsResult {
  const { year, autoLoad = true } = options
  const { user, loading: authLoading } = useAuth()
  const userId = user?.id ?? null
  const queryClient = useQueryClient()

  const [refreshing, setRefreshing] = useState(false)

  const query = useQuery({
    queryKey: [QK.BUDGET_ANALYTICS, userId, year],
    queryFn: () => fetchBudgetAnalyticsData(year),
    enabled: !!userId && !authLoading && autoLoad,
    staleTime: 5 * 60_000,
  })

  const reloadOnly = useCallback(async () => {
    await query.refetch()
  }, [query])

  const refreshAndReload = useCallback(async () => {
    if (!userId) return
    setRefreshing(true)
    try {
      await queryClient.invalidateQueries({ queryKey: [QK.BUDGET_ANALYTICS, userId, year] })
    } finally {
      setRefreshing(false)
    }
  }, [userId, year, queryClient])

  return {
    loading: autoLoad ? query.isPending : false,
    refreshing,
    error: query.error?.message ?? null,
    monthlyMetrics: query.data?.monthlyMetrics ?? [],
    monthlyVariableCategories: query.data?.monthlyVariableCategories ?? [],
    variableCategorySummary: query.data?.variableCategorySummary ?? [],
    refreshedAt: query.data?.refreshedAt ?? null,
    refreshAndReload,
    reloadOnly,
  }
}
