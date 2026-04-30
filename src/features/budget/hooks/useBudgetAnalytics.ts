import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { refreshBudgetAnalytics } from '@/features/budget/api/refreshBudgetAnalytics'
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

export function useBudgetAnalytics(options: UseBudgetAnalyticsOptions = {}): UseBudgetAnalyticsResult {
  const { year, autoRefresh = false, autoLoad = true } = options
  const { user, loading: authLoading } = useAuth()
  const userId = user?.id ?? null

  const [loading, setLoading] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [monthlyMetrics, setMonthlyMetrics] = useState<AnalyticsMonthlyMetrics[]>([])
  const [monthlyVariableCategories, setMonthlyVariableCategories] = useState<AnalyticsMonthlyCategoryMetrics[]>([])
  const [variableCategorySummary, setVariableCategorySummary] = useState<AnalyticsVariableCategorySummary[]>([])
  const [refreshedAt, setRefreshedAt] = useState<string | null>(null)

  const mountedRef = useRef(true)
  const runIdRef = useRef(0)

  useEffect(() => {
    mountedRef.current = true

    return () => {
      mountedRef.current = false
    }
  }, [])

  const loadDatasets = useCallback(async (): Promise<void> => {
    if (!userId) {
      throw new Error('Utilisateur non connecté: impossible de charger les analytics budget.')
    }

    const runId = ++runIdRef.current

    const [metrics, variableCategories, categorySummary] = await Promise.all([
      getMonthlyMetrics(year),
      getMonthlyVariableCategories(year),
      getVariableCategorySummary(),
    ])

    if (!mountedRef.current || runId !== runIdRef.current) return

    setMonthlyMetrics(metrics)
    setMonthlyVariableCategories(variableCategories)
    setVariableCategorySummary(categorySummary)
    setRefreshedAt(pickLatestRefreshedAt(metrics, variableCategories, categorySummary))
  }, [userId, year])

  const reloadOnly = useCallback(async () => {
    if (!userId) {
      setError('Utilisateur non connecté: impossible de charger les analytics budget.')
      return
    }

    setLoading(true)
    setError(null)
    try {
      await loadDatasets()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Chargement analytics impossible.'
      if (mountedRef.current) setError(message)
    } finally {
      if (mountedRef.current) setLoading(false)
    }
  }, [loadDatasets, userId])

  const refreshAndReload = useCallback(async () => {
    if (!userId) {
      setError('Utilisateur non connecté: impossible de recalculer les analytics budget.')
      return
    }

    setRefreshing(true)
    setError(null)
    try {
      await refreshBudgetAnalytics(userId)
      await loadDatasets()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Recalcul analytics impossible.'
      if (mountedRef.current) setError(message)
    } finally {
      if (mountedRef.current) setRefreshing(false)
    }
  }, [loadDatasets, userId])

  useEffect(() => {
    if (!autoLoad) return
    if (authLoading) return

    if (!userId) {
      setError('Utilisateur non connecté: analytics budget indisponibles.')
      return
    }

    if (autoRefresh) {
      void refreshAndReload()
      return
    }

    void reloadOnly()
  }, [autoLoad, autoRefresh, authLoading, refreshAndReload, reloadOnly, userId])

  return useMemo(
    () => ({
      loading,
      refreshing,
      error,
      monthlyMetrics,
      monthlyVariableCategories,
      variableCategorySummary,
      refreshedAt,
      refreshAndReload,
      reloadOnly,
    }),
    [
      loading,
      refreshing,
      error,
      monthlyMetrics,
      monthlyVariableCategories,
      variableCategorySummary,
      refreshedAt,
      refreshAndReload,
      reloadOnly,
    ],
  )
}
