import { useSyncExternalStore } from 'react'
import { readOfflineValue, writeOfflineValue } from '@/lib/offlineStorage'
import { getBudgetBucketTotalsByPeriod } from '@/features/stats/api/getBudgetBucketTotalsByPeriod'
import { getBudgetBucketVsActualByMonth } from '@/features/stats/api/getBudgetBucketVsActualByMonth'
import { getBudgetGlobalVariableForPeriod } from '@/features/stats/api/getBudgetGlobalVariableForPeriod'
import { getExpenseBudgetTotalForPeriod } from '@/features/stats/api/getExpenseBudgetTotalForPeriod'
import { getLatestBudgetPeriod } from '@/features/stats/api/getLatestBudgetPeriod'
import { getMonthlyEvolution2026 } from '@/features/stats/api/getMonthlyEvolution2026'
import { getSavingsBudgetLinesByPeriod } from '@/features/stats/api/getSavingsBudgetLinesByPeriod'
import { getSavingsBudgetTotalsByPeriod } from '@/features/stats/api/getSavingsBudgetTotalsByPeriod'
import { getSavingsBudgetVsActualByPeriod } from '@/features/stats/api/getSavingsBudgetVsActualByPeriod'
import type { StatsReferenceSnapshot, StatsSelectedPeriod } from '@/features/stats/types'
import {
  buildBudgetBucketVsActual,
  buildBudgetSummary,
  buildMonthlyEvolution2026,
  buildSavingsLines,
  buildSavingsSummary,
  buildTotalMonthlyNeed,
} from '@/features/stats/utils/statsReferenceSelectors'

const STATS_REFERENCE_STORAGE_KEY = 'dashboard_budget:stats_reference_snapshot:v1'

type StatsReferenceState = {
  snapshot: StatsReferenceSnapshot | null
  loading: boolean
  error: string | null
  isHydrated: boolean
}

type HydrateOptions = {
  force?: boolean
  period?: Partial<StatsSelectedPeriod>
}

const listeners = new Set<() => void>()
const initialSnapshot = readSnapshotSync()

const state: StatsReferenceState = {
  snapshot: initialSnapshot,
  loading: false,
  error: null,
  isHydrated: initialSnapshot !== null,
}

let restoreTaskStarted = false

function emitChange() {
  listeners.forEach((listener) => listener())
}

function setState(next: Partial<StatsReferenceState>) {
  Object.assign(state, next)
  emitChange()
}

function readSnapshotSync(): StatsReferenceSnapshot | null {
  if (typeof window === 'undefined') return null

  const raw = window.localStorage.getItem(STATS_REFERENCE_STORAGE_KEY)
  if (!raw) return null

  try {
    return JSON.parse(raw) as StatsReferenceSnapshot
  } catch {
    return null
  }
}

async function persistSnapshot(snapshot: StatsReferenceSnapshot | null): Promise<void> {
  if (!snapshot) {
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem(STATS_REFERENCE_STORAGE_KEY)
    }
    return
  }

  await writeOfflineValue(STATS_REFERENCE_STORAGE_KEY, snapshot)
}

async function restoreSnapshotAsync() {
  if (restoreTaskStarted) return
  restoreTaskStarted = true

  const persistedSnapshot = await readOfflineValue<StatsReferenceSnapshot>(STATS_REFERENCE_STORAGE_KEY)
  if (!persistedSnapshot) return

  setState({
    snapshot: persistedSnapshot,
    isHydrated: true,
    error: null,
  })
}

function buildSelectedPeriod(
  fallbackPeriod: { id: string; period_year: number; period_month: number; label: string } | null,
  override?: Partial<StatsSelectedPeriod>,
): StatsSelectedPeriod {
  return {
    id: override?.id ?? fallbackPeriod?.id ?? null,
    periodYear: override?.periodYear ?? fallbackPeriod?.period_year ?? null,
    periodMonth: override?.periodMonth ?? fallbackPeriod?.period_month ?? null,
    label: override?.label ?? fallbackPeriod?.label ?? null,
  }
}

function resolvePeriodFromStateOrInput(input?: Partial<StatsSelectedPeriod>): Partial<StatsSelectedPeriod> {
  if (input?.periodYear && input?.periodMonth) {
    return input
  }

  if (state.snapshot?.selectedPeriod.periodYear && state.snapshot.selectedPeriod.periodMonth) {
    return state.snapshot.selectedPeriod
  }

  return {}
}

export async function hydrateStatsReferenceData(options: HydrateOptions = {}): Promise<StatsReferenceSnapshot> {
  const { force = false } = options

  if (state.loading) {
    throw new Error('Hydratation Stats déjà en cours.')
  }

  if (!force && state.snapshot) {
    return state.snapshot
  }

  setState({ loading: true, error: null })

  try {
    const periodCandidate = resolvePeriodFromStateOrInput(options.period)

    const latestPeriod =
      periodCandidate.periodYear && periodCandidate.periodMonth
        ? null
        : await getLatestBudgetPeriod()

    const selectedPeriod = buildSelectedPeriod(latestPeriod, periodCandidate)

    if (!selectedPeriod.periodYear || !selectedPeriod.periodMonth) {
      throw new Error('Impossible de déterminer la période budgétaire à hydrater.')
    }

    const periodYear = selectedPeriod.periodYear
    const periodMonth = selectedPeriod.periodMonth

    const [
      budgetBucketTotals,
      globalVariableBudget,
      totalExpenseBudget,
      budgetBucketVsActual,
      savingsBudgetTotals,
      savingsBudgetLines,
      savingsBudgetVsActual,
      monthlyEvolution2026,
    ] = await Promise.all([
      getBudgetBucketTotalsByPeriod(periodYear, periodMonth),
      getBudgetGlobalVariableForPeriod(periodYear, periodMonth),
      getExpenseBudgetTotalForPeriod(periodYear, periodMonth),
      getBudgetBucketVsActualByMonth(periodYear, periodMonth),
      getSavingsBudgetTotalsByPeriod(periodYear, periodMonth),
      getSavingsBudgetLinesByPeriod(periodYear, periodMonth),
      getSavingsBudgetVsActualByPeriod(periodYear, periodMonth),
      getMonthlyEvolution2026(),
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

    const snapshot: StatsReferenceSnapshot = {
      loadedAt: new Date().toISOString(),
      selectedPeriod,
      budgetSummary,
      budgetBucketVsActual: buildBudgetBucketVsActual(budgetBucketVsActual),
      savingsSummary,
      savingsLines: buildSavingsLines(savingsBudgetLines, savingsBudgetVsActual),
      totalMonthlyNeed: buildTotalMonthlyNeed(budgetSummary.totalExpenseBudget, savingsSummary.totalSavingsBudget),
      monthlyEvolution2026: buildMonthlyEvolution2026(monthlyEvolution2026),
    }

    setState({
      snapshot,
      loading: false,
      error: null,
      isHydrated: true,
    })

    await persistSnapshot(snapshot)

    return snapshot
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Hydratation Stats impossible.'
    setState({
      loading: false,
      error: message,
      isHydrated: Boolean(state.snapshot),
    })
    throw new Error(message)
  }
}

export async function setSelectedPeriod(period: Partial<StatsSelectedPeriod>): Promise<void> {
  const currentSnapshot = state.snapshot

  if (!period.periodYear || !period.periodMonth) {
    throw new Error('setSelectedPeriod exige periodYear et periodMonth.')
  }

  if (!currentSnapshot) {
    await hydrateStatsReferenceData({ force: true, period })
    return
  }

  await hydrateStatsReferenceData({ force: true, period })
}

export async function clearSnapshot(): Promise<void> {
  setState({
    snapshot: null,
    error: null,
    isHydrated: false,
  })

  await persistSnapshot(null)
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
  restoreSnapshotAsync().catch(() => {
    // silent restore failure
  })

  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
}

export function useStatsReferenceSnapshot(): StatsReferenceSnapshot | null {
  const { snapshot } = useStatsReferenceStore()
  return snapshot
}
