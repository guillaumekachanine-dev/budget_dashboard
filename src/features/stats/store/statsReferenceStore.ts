import { useSyncExternalStore } from 'react'
import { readOfflineValue, writeOfflineValue } from '@/lib/offlineStorage'
import { supabase } from '@/lib/supabase'
import { getBudgetBucketTotalsByPeriod } from '@/features/stats/api/getBudgetBucketTotalsByPeriod'
import { getBudgetBucketVsActualByMonth } from '@/features/stats/api/getBudgetBucketVsActualByMonth'
import { getBudgetGlobalVariableForPeriod } from '@/features/stats/api/getBudgetGlobalVariableForPeriod'
import { getExpenseBudgetTotalForPeriod } from '@/features/stats/api/getExpenseBudgetTotalForPeriod'
import { getMonthlyEvolution2026 } from '@/features/stats/api/getMonthlyEvolution2026'
import {
  getLatestUsableStatsPeriod,
  getUsableStatsMonthlyPeriods,
  hasUsableStatsPeriod,
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

const STATS_REFERENCE_STORAGE_KEY_BASE = 'dashboard_budget:stats_reference_snapshot:v1'
const SNAPSHOT_STALE_AFTER_MS = 5 * 60 * 1000
const STATS_REFERENCE_YEAR = 2026

type StatsReferenceState = {
  snapshot: StatsReferenceSnapshot | null
  loading: boolean
  error: string | null
  isHydrated: boolean
  userId: string | null
}

type HydrateOptions = {
  force?: boolean
  period?: StatsSelectedPeriod
  userId?: string | null
  ignoreStoredSelectedPeriod?: boolean
}

const listeners = new Set<() => void>()
const initialSnapshot = readSnapshotSync()

const state: StatsReferenceState = {
  snapshot: initialSnapshot,
  loading: false,
  error: null,
  isHydrated: initialSnapshot !== null,
  userId: null,
}

let restoreTaskStarted = false
let inFlightHydration: Promise<StatsReferenceSnapshot> | null = null

function emitChange() {
  listeners.forEach((listener) => listener())
}

function setState(next: Partial<StatsReferenceState>) {
  Object.assign(state, next)
  emitChange()
}

function readSnapshotSync(): StatsReferenceSnapshot | null {
  return null
}

function getStorageKey(userId: string): string {
  return `${STATS_REFERENCE_STORAGE_KEY_BASE}:${userId}`
}

function isSnapshotStale(snapshot: StatsReferenceSnapshot | null): boolean {
  if (!snapshot?.loadedAt) return true
  const loadedAtMs = new Date(snapshot.loadedAt).getTime()
  if (Number.isNaN(loadedAtMs)) return true
  return Date.now() - loadedAtMs > SNAPSHOT_STALE_AFTER_MS
}

export function isStatsReferenceSnapshotStale(snapshot: StatsReferenceSnapshot | null): boolean {
  return isSnapshotStale(snapshot)
}

function buildMonthLabel(periodYear: number, periodMonth: number): string {
  const date = new Date(periodYear, periodMonth - 1, 1)
  return date.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })
}

function pickFinalSelectedPeriod(
  candidate: StatsSelectedPeriod | null,
  monthlyReferences: StatsMonthlyReference[],
): StatsSelectedPeriod {
  const latestMonth = monthlyReferences[0]

  if (!latestMonth) {
    return {
      id: null,
      period_year: STATS_REFERENCE_YEAR,
      period_month: new Date().getMonth() + 1,
      label: null,
    }
  }

  if (candidate) {
    const matchedMonth = monthlyReferences.find(
      (row) => row.periodYear === candidate.period_year && row.periodMonth === candidate.period_month,
    )

    if (matchedMonth) {
      return {
        id: matchedMonth.id,
        period_year: matchedMonth.periodYear,
        period_month: matchedMonth.periodMonth,
        label: matchedMonth.label,
      }
    }
  }

  return {
    id: latestMonth.id,
    period_year: latestMonth.periodYear,
    period_month: latestMonth.periodMonth,
    label: latestMonth.label,
  }
}

async function resolveCurrentUserId(explicitUserId?: string | null): Promise<string | null> {
  if (typeof explicitUserId === 'string') return explicitUserId
  const { data, error } = await supabase.auth.getSession()
  if (error) return null
  return data.session?.user?.id ?? null
}

async function persistSnapshot(snapshot: StatsReferenceSnapshot | null, userId: string | null): Promise<void> {
  if (!userId) return
  const storageKey = getStorageKey(userId)

  if (!snapshot) {
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem(storageKey)
    }
    return
  }

  await writeOfflineValue(storageKey, snapshot)
}

function isSelectedPeriodShape(value: unknown): value is StatsSelectedPeriod {
  if (!value || typeof value !== 'object') return false
  const period = value as Record<string, unknown>
  return (
    (typeof period.id === 'string' || period.id === null || period.id === undefined)
    && typeof period.period_year === 'number'
    && typeof period.period_month === 'number'
    && (typeof period.label === 'string' || period.label === null || period.label === undefined)
  )
}

async function restoreSnapshotAsync(userId?: string | null) {
  if (restoreTaskStarted) return
  restoreTaskStarted = true

  const resolvedUserId = await resolveCurrentUserId(userId)
  if (!resolvedUserId) return

  const persistedSnapshot = await readOfflineValue<StatsReferenceSnapshot>(getStorageKey(resolvedUserId))
  if (!persistedSnapshot) return
  if (!isSelectedPeriodShape(persistedSnapshot.selectedPeriod)) return

  setState({
    snapshot: persistedSnapshot,
    isHydrated: true,
    error: null,
    userId: resolvedUserId,
  })
}

function resolvePeriodFromStateOrInput(input?: StatsSelectedPeriod, ignoreStoredSelectedPeriod = false): StatsSelectedPeriod | null {
  if (input) return input
  if (ignoreStoredSelectedPeriod) return null
  if (state.snapshot?.selectedPeriod && isSelectedPeriodShape(state.snapshot.selectedPeriod)) {
    return state.snapshot.selectedPeriod
  }
  return null
}

async function fetchMonthlyReference(period: UsableStatsPeriod): Promise<StatsMonthlyReference> {
  const periodYear = period.period_year
  const periodMonth = period.period_month

  const [
    budgetBucketTotals,
    globalVariableBudget,
    totalExpenseBudget,
    budgetBucketVsActual,
    savingsBudgetTotals,
    savingsBudgetLines,
    savingsBudgetVsActual,
  ] = await Promise.all([
    getBudgetBucketTotalsByPeriod(periodYear, periodMonth),
    getBudgetGlobalVariableForPeriod(periodYear, periodMonth),
    getExpenseBudgetTotalForPeriod(periodYear, periodMonth),
    getBudgetBucketVsActualByMonth(periodYear, periodMonth),
    getSavingsBudgetTotalsByPeriod(periodYear, periodMonth),
    getSavingsBudgetLinesByPeriod(periodYear, periodMonth),
    getSavingsBudgetVsActualByPeriod(periodYear, periodMonth),
  ])

  const budgetSummary = buildBudgetSummary(
    budgetBucketTotals,
    totalExpenseBudget,
    globalVariableBudget,
  )

  const savingsSummary = buildSavingsSummary(
    savingsBudgetTotals,
    savingsBudgetVsActual,
    savingsBudgetLines,
  )

  return {
    periodYear,
    periodMonth,
    label: period.label ?? buildMonthLabel(periodYear, periodMonth),
    id: isValidUuid(period.id) ? period.id : null,
    budgetSummary,
    budgetBucketVsActual: buildBudgetBucketVsActual(budgetBucketVsActual),
    savingsSummary,
    savingsLines: buildSavingsLines(savingsBudgetLines, savingsBudgetVsActual),
    totalMonthlyNeed: buildTotalMonthlyNeed(budgetSummary.totalExpenseBudget, savingsSummary.totalSavingsBudget),
  }
}

function buildDisplayData(
  selectedPeriod: StatsSelectedPeriod,
  monthlyReferences: StatsMonthlyReference[],
): Pick<
  StatsReferenceSnapshot,
  'budgetSummary' | 'budgetBucketVsActual' | 'savingsSummary' | 'savingsLines' | 'totalMonthlyNeed'
> {
  const monthRow = monthlyReferences.find(
    (row) => row.periodYear === selectedPeriod.period_year && row.periodMonth === selectedPeriod.period_month,
  ) ?? monthlyReferences[0]

  return {
    budgetSummary: monthRow?.budgetSummary ?? {
      totalExpenseBudget: 0,
      globalVariableBudget: 0,
      socleFixeBudget: 0,
      variableEssentielleBudget: 0,
      provisionBudget: 0,
      discretionnaireBudget: 0,
      cagnotteProjetBudget: 0,
    },
    budgetBucketVsActual: monthRow?.budgetBucketVsActual ?? [],
    savingsSummary: monthRow?.savingsSummary ?? {
      totalSavingsBudget: 0,
      totalSavingsActual: 0,
      deltaSavings: 0,
    },
    savingsLines: monthRow?.savingsLines ?? [],
    totalMonthlyNeed: monthRow?.totalMonthlyNeed ?? 0,
  }
}

export async function hydrateStatsReferenceData(options: HydrateOptions = {}): Promise<StatsReferenceSnapshot> {
  if (inFlightHydration) {
    return inFlightHydration
  }

  const { force = false } = options
  const task = (async () => {
    const resolvedUserId = await resolveCurrentUserId(options.userId)

    if (state.userId && resolvedUserId && state.userId !== resolvedUserId) {
      setState({
        snapshot: null,
        isHydrated: false,
        error: null,
      })
    }

    if (!force && state.snapshot && state.userId === resolvedUserId && !isSnapshotStale(state.snapshot)) {
      return state.snapshot
    }

    setState({ loading: true, error: null, userId: resolvedUserId })

    try {
      const periodCandidate = resolvePeriodFromStateOrInput(options.period, options.ignoreStoredSelectedPeriod === true)
      let checkedCandidate = periodCandidate

      if (checkedCandidate) {
        const isExpectedYear = checkedCandidate.period_year === STATS_REFERENCE_YEAR
        const exists = await hasUsableStatsPeriod(checkedCandidate.period_year, checkedCandidate.period_month)
        if (!isExpectedYear || !exists) {
          checkedCandidate = null
        }
      }

      const usablePeriods = await getUsableStatsMonthlyPeriods(STATS_REFERENCE_YEAR)

      if (usablePeriods.length === 0) {
        const latestPeriod = await getLatestUsableStatsPeriod()
        const selectedPeriod: StatsSelectedPeriod = latestPeriod
          ? {
              id: latestPeriod.id,
              period_year: latestPeriod.period_year,
              period_month: latestPeriod.period_month,
              label: latestPeriod.label,
            }
          : {
              id: null,
              period_year: STATS_REFERENCE_YEAR,
              period_month: new Date().getMonth() + 1,
              label: null,
            }

        const emptyMonthlyEvolution = await getMonthlyEvolution2026().catch(() => [])
        const emptySnapshot: StatsReferenceSnapshot = {
          loadedAt: new Date().toISOString(),
          selectedPeriod,
          availablePeriodOptions: [],
          monthlyReferences: [],
          budgetSummary: {
            totalExpenseBudget: 0,
            globalVariableBudget: 0,
            socleFixeBudget: 0,
            variableEssentielleBudget: 0,
            provisionBudget: 0,
            discretionnaireBudget: 0,
            cagnotteProjetBudget: 0,
          },
          budgetBucketVsActual: [],
          savingsSummary: {
            totalSavingsBudget: 0,
            totalSavingsActual: 0,
            deltaSavings: 0,
          },
          savingsLines: [],
          totalMonthlyNeed: 0,
          monthlyEvolution2026: buildMonthlyEvolution2026(emptyMonthlyEvolution),
        }

        setState({
          snapshot: emptySnapshot,
          loading: false,
          error: null,
          isHydrated: true,
          userId: resolvedUserId,
        })

        await persistSnapshot(emptySnapshot, resolvedUserId)
        return emptySnapshot
      }

      const monthlyReferences = await Promise.all(usablePeriods.map((period) => fetchMonthlyReference(period)))
      monthlyReferences.sort((a, b) => {
        if (a.periodYear !== b.periodYear) return b.periodYear - a.periodYear
        return b.periodMonth - a.periodMonth
      })

      const selectedPeriod = pickFinalSelectedPeriod(checkedCandidate, monthlyReferences)
      const monthlyEvolution2026 = await getMonthlyEvolution2026()
      const displayData = buildDisplayData(selectedPeriod, monthlyReferences)

      const snapshot: StatsReferenceSnapshot = {
        loadedAt: new Date().toISOString(),
        selectedPeriod,
        availablePeriodOptions: buildStatsPeriodOptions(monthlyReferences),
        monthlyReferences,
        budgetSummary: displayData.budgetSummary,
        budgetBucketVsActual: displayData.budgetBucketVsActual,
        savingsSummary: displayData.savingsSummary,
        savingsLines: displayData.savingsLines,
        totalMonthlyNeed: displayData.totalMonthlyNeed,
        monthlyEvolution2026: buildMonthlyEvolution2026(monthlyEvolution2026),
      }

      setState({
        snapshot,
        loading: false,
        error: null,
        isHydrated: true,
        userId: resolvedUserId,
      })

      await persistSnapshot(snapshot, resolvedUserId)

      return snapshot
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Hydratation Stats impossible.'
      setState({
        loading: false,
        error: message,
        isHydrated: Boolean(state.snapshot),
      })
      throw new Error(message)
    } finally {
      inFlightHydration = null
    }
  })()

  inFlightHydration = task
  return task
}

export async function setSelectedPeriod(period: StatsSelectedPeriod): Promise<void> {
  await hydrateStatsReferenceData({ force: true, period })
}

export async function resetSelectedPeriodToDefault(userId?: string | null): Promise<void> {
  if (!state.snapshot?.monthlyReferences?.length) {
    await hydrateStatsReferenceData({
      force: true,
      userId: userId ?? undefined,
      ignoreStoredSelectedPeriod: true,
    })
    return
  }

  const latestMonth = state.snapshot.monthlyReferences[0]
  const defaultSelectedPeriod: StatsSelectedPeriod = {
    id: latestMonth.id,
    period_year: latestMonth.periodYear,
    period_month: latestMonth.periodMonth,
    label: latestMonth.label,
  }

  if (
    state.snapshot.selectedPeriod.period_year === defaultSelectedPeriod.period_year
    && state.snapshot.selectedPeriod.period_month === defaultSelectedPeriod.period_month
  ) {
    return
  }

  const displayData = buildDisplayData(defaultSelectedPeriod, state.snapshot.monthlyReferences)
  const updatedSnapshot: StatsReferenceSnapshot = {
    ...state.snapshot,
    selectedPeriod: defaultSelectedPeriod,
    budgetSummary: displayData.budgetSummary,
    budgetBucketVsActual: displayData.budgetBucketVsActual,
    savingsSummary: displayData.savingsSummary,
    savingsLines: displayData.savingsLines,
    totalMonthlyNeed: displayData.totalMonthlyNeed,
  }

  const resolvedUserId = await resolveCurrentUserId(userId ?? state.userId)

  setState({
    snapshot: updatedSnapshot,
    error: null,
    isHydrated: true,
    userId: resolvedUserId,
  })

  await persistSnapshot(updatedSnapshot, resolvedUserId)
}

export async function clearSnapshot(): Promise<void> {
  const resolvedUserId = await resolveCurrentUserId()

  setState({
    snapshot: null,
    error: null,
    isHydrated: false,
    userId: resolvedUserId,
  })

  await persistSnapshot(null, resolvedUserId)
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

function getSnapshot(): StatsReferenceState {
  return state
}

export function useStatsReferenceStore(): StatsReferenceState {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
}

export function useStatsReferenceSnapshot(): StatsReferenceSnapshot | null {
  const { snapshot } = useStatsReferenceStore()
  return snapshot
}

void restoreSnapshotAsync().catch(() => {
  // silent restore failure
})
