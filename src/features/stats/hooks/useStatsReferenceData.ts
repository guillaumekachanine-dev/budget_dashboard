import { useCallback, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/hooks/useAuth'
import { QK } from '@/lib/queryKeys'
import { getBudgetBucketTotalsByPeriod } from '@/features/stats/api/getBudgetBucketTotalsByPeriod'
import { getBudgetBucketVsActualByMonth } from '@/features/stats/api/getBudgetBucketVsActualByMonth'
import { getBudgetGlobalVariableForPeriod } from '@/features/stats/api/getBudgetGlobalVariableForPeriod'
import { getExpenseBudgetTotalForPeriod } from '@/features/stats/api/getExpenseBudgetTotalForPeriod'
import { getMonthlyEvolution2026 } from '@/features/stats/api/getMonthlyEvolution2026'
import {
  getLatestUsableStatsPeriod,
  getUsableStatsMonthlyPeriods,
  type UsableStatsPeriod,
} from '@/features/stats/api/getLatestUsableStatsPeriod'
import { getSavingsBudgetLinesByPeriod } from '@/features/stats/api/getSavingsBudgetLinesByPeriod'
import { getSavingsBudgetTotalsByPeriod } from '@/features/stats/api/getSavingsBudgetTotalsByPeriod'
import { getSavingsBudgetVsActualByPeriod } from '@/features/stats/api/getSavingsBudgetVsActualByPeriod'
import { isValidUuid } from '@/features/stats/api/_shared'
import type {
  StatsMonthlyReference,
  StatsReferenceSnapshot,
  StatsSelectedPeriod,
} from '@/features/stats/types'
import {
  buildBudgetBucketVsActual,
  buildBudgetSummary,
  buildMonthlyEvolution2026,
  buildSavingsLines,
  buildSavingsSummary,
  buildStatsPeriodOptions,
  buildTotalMonthlyNeed,
} from '@/features/stats/utils/statsReferenceSelectors'

const STATS_REFERENCE_YEAR = 2026

function buildMonthLabel(periodYear: number, periodMonth: number): string {
  return new Date(periodYear, periodMonth - 1, 1).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })
}

function buildEmptyBudgetSummary(): StatsReferenceSnapshot['budgetSummary'] {
  return {
    totalExpenseBudget: 0,
    globalVariableBudget: 0,
    socleFixeBudget: 0,
    variableEssentielleBudget: 0,
    provisionBudget: 0,
    discretionnaireBudget: 0,
    cagnotteProjetBudget: 0,
  }
}

async function fetchMonthlyReference(period: UsableStatsPeriod): Promise<StatsMonthlyReference> {
  const [
    budgetBucketTotals,
    globalVariableBudget,
    totalExpenseBudget,
    budgetBucketVsActual,
    savingsBudgetTotals,
    savingsBudgetLines,
    savingsBudgetVsActual,
  ] = await Promise.all([
    getBudgetBucketTotalsByPeriod(period.period_year, period.period_month),
    getBudgetGlobalVariableForPeriod(period.id),
    getExpenseBudgetTotalForPeriod(period.id),
    getBudgetBucketVsActualByMonth(period.period_year, period.period_month),
    getSavingsBudgetTotalsByPeriod(period.period_year, period.period_month),
    getSavingsBudgetLinesByPeriod(period.period_year, period.period_month),
    getSavingsBudgetVsActualByPeriod(period.period_year, period.period_month),
  ])

  const budgetSummary = buildBudgetSummary(budgetBucketTotals, totalExpenseBudget, globalVariableBudget)
  const savingsSummary = buildSavingsSummary(savingsBudgetTotals, savingsBudgetVsActual, savingsBudgetLines)

  return {
    periodYear: period.period_year,
    periodMonth: period.period_month,
    label: period.label ?? buildMonthLabel(period.period_year, period.period_month),
    id: isValidUuid(period.id) ? period.id : null,
    budgetSummary,
    budgetBucketVsActual: buildBudgetBucketVsActual(budgetBucketVsActual),
    savingsSummary,
    savingsLines: buildSavingsLines(savingsBudgetLines, savingsBudgetVsActual),
    totalMonthlyNeed: buildTotalMonthlyNeed(budgetSummary.totalExpenseBudget, savingsSummary.totalSavingsBudget),
  }
}

type StatsReferenceData = {
  monthlyReferences: StatsMonthlyReference[]
  availablePeriodOptions: StatsReferenceSnapshot['availablePeriodOptions']
  monthlyEvolution2026: StatsReferenceSnapshot['monthlyEvolution2026']
  loadedAt: string
}

async function fetchStatsReferenceData(userId: string): Promise<StatsReferenceData> {
  const usablePeriods = await getUsableStatsMonthlyPeriods(userId, STATS_REFERENCE_YEAR)

  if (usablePeriods.length === 0) {
    await getLatestUsableStatsPeriod(userId).catch(() => null)
    const monthlyEvolution2026Raw = await getMonthlyEvolution2026().catch(() => [])
    return {
      monthlyReferences: [],
      availablePeriodOptions: [],
      monthlyEvolution2026: buildMonthlyEvolution2026(monthlyEvolution2026Raw),
      loadedAt: new Date().toISOString(),
    }
  }

  const [monthlyReferences, monthlyEvolution2026Raw] = await Promise.all([
    Promise.all(usablePeriods.map(fetchMonthlyReference)),
    getMonthlyEvolution2026(),
  ])

  monthlyReferences.sort((a, b) => {
    if (a.periodYear !== b.periodYear) return b.periodYear - a.periodYear
    return b.periodMonth - a.periodMonth
  })

  return {
    monthlyReferences,
    availablePeriodOptions: buildStatsPeriodOptions(monthlyReferences),
    monthlyEvolution2026: buildMonthlyEvolution2026(monthlyEvolution2026Raw),
    loadedAt: new Date().toISOString(),
  }
}

function resolveSelectedPeriod(
  requested: StatsSelectedPeriod | null,
  monthlyReferences: StatsMonthlyReference[],
): StatsSelectedPeriod {
  if (requested) {
    const match = monthlyReferences.find(
      (m) => m.periodYear === requested.period_year && m.periodMonth === requested.period_month,
    )
    if (match) return requested
  }
  const latest = monthlyReferences[0]
  if (latest) {
    return { id: latest.id, period_year: latest.periodYear, period_month: latest.periodMonth, label: latest.label }
  }
  return { id: null, period_year: STATS_REFERENCE_YEAR, period_month: new Date().getMonth() + 1, label: null }
}

function buildDisplayData(
  selectedPeriod: StatsSelectedPeriod,
  monthlyReferences: StatsMonthlyReference[],
): Pick<StatsReferenceSnapshot, 'budgetSummary' | 'budgetBucketVsActual' | 'savingsSummary' | 'savingsLines' | 'totalMonthlyNeed'> {
  const monthRow = monthlyReferences.find(
    (row) => row.periodYear === selectedPeriod.period_year && row.periodMonth === selectedPeriod.period_month,
  ) ?? monthlyReferences[0]

  return {
    budgetSummary: monthRow?.budgetSummary ?? buildEmptyBudgetSummary(),
    budgetBucketVsActual: monthRow?.budgetBucketVsActual ?? [],
    savingsSummary: monthRow?.savingsSummary ?? { totalSavingsBudget: 0, totalSavingsActual: 0, deltaSavings: 0 },
    savingsLines: monthRow?.savingsLines ?? [],
    totalMonthlyNeed: monthRow?.totalMonthlyNeed ?? 0,
  }
}

export function useStatsReferenceData() {
  const { user } = useAuth()
  const userId = user?.id ?? null
  const queryClient = useQueryClient()

  const [selectedPeriodState, setSelectedPeriodState] = useState<StatsSelectedPeriod | null>(null)

  const query = useQuery({
    queryKey: [QK.STATS_REFERENCE, userId],
    queryFn: () => fetchStatsReferenceData(userId!),
    enabled: !!userId,
    staleTime: 5 * 60_000,
  })

  const monthlyReferences = query.data?.monthlyReferences ?? []
  const effectiveSelectedPeriod = resolveSelectedPeriod(selectedPeriodState, monthlyReferences)

  const snapshot: StatsReferenceSnapshot | null = query.data
    ? {
        loadedAt: query.data.loadedAt,
        selectedPeriod: effectiveSelectedPeriod,
        availablePeriodOptions: query.data.availablePeriodOptions,
        monthlyReferences,
        ...buildDisplayData(effectiveSelectedPeriod, monthlyReferences),
        monthlyEvolution2026: query.data.monthlyEvolution2026,
      }
    : null

  const hydrateStatsReferenceData = useCallback(
    async (_opts?: { force?: boolean; userId?: string | null; period?: StatsSelectedPeriod; ignoreStoredSelectedPeriod?: boolean }) => {
      await queryClient.invalidateQueries({ queryKey: [QK.STATS_REFERENCE, userId] })
      return snapshot ?? ({} as StatsReferenceSnapshot)
    },
    [queryClient, userId, snapshot],
  )

  const setSelectedPeriod = useCallback(async (period: StatsSelectedPeriod) => {
    setSelectedPeriodState(period)
  }, [])

  const resetSelectedPeriodToDefault = useCallback(async (_userId?: string | null) => {
    setSelectedPeriodState(null)
  }, [])

  const clearSnapshot = useCallback(async () => {
    setSelectedPeriodState(null)
    await queryClient.resetQueries({ queryKey: [QK.STATS_REFERENCE, userId] })
  }, [queryClient, userId])

  return {
    snapshot,
    loading: query.isPending,
    error: query.error?.message ?? null,
    isHydrated: query.isSuccess,
    storeUserId: userId,
    hydrateStatsReferenceData,
    setSelectedPeriod,
    resetSelectedPeriodToDefault,
    clearSnapshot,
  }
}

export function useStatsReferenceSnapshot(): StatsReferenceSnapshot | null {
  const { snapshot } = useStatsReferenceData()
  return snapshot
}
