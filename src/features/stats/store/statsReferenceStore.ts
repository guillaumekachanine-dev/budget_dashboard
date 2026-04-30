import { useSyncExternalStore } from 'react'
import { readOfflineValue, writeOfflineValue } from '@/lib/offlineStorage'
import { supabase } from '@/lib/supabase'
import { getBudgetBucketTotalsByPeriod } from '@/features/stats/api/getBudgetBucketTotalsByPeriod'
import { getBudgetBucketVsActualByMonth } from '@/features/stats/api/getBudgetBucketVsActualByMonth'
import { getBudgetGlobalVariableForPeriod } from '@/features/stats/api/getBudgetGlobalVariableForPeriod'
import { getExpenseBudgetTotalForPeriod } from '@/features/stats/api/getExpenseBudgetTotalForPeriod'
import { getMonthlyEvolution2026 } from '@/features/stats/api/getMonthlyEvolution2026'
import { getLatestUsableStatsPeriod, hasUsableStatsPeriod } from '@/features/stats/api/getLatestUsableStatsPeriod'
import { getSavingsBudgetLinesByPeriod } from '@/features/stats/api/getSavingsBudgetLinesByPeriod'
import { getSavingsBudgetTotalsByPeriod } from '@/features/stats/api/getSavingsBudgetTotalsByPeriod'
import { getSavingsBudgetVsActualByPeriod } from '@/features/stats/api/getSavingsBudgetVsActualByPeriod'
import { isValidUuid } from '@/features/stats/api/_shared'
import type { StatsReferenceSnapshot, StatsSelectedPeriod } from '@/features/stats/types'
import {
  buildBudgetBucketVsActual,
  buildBudgetSummary,
  buildMonthlyEvolution2026,
  buildSavingsLines,
  buildSavingsSummary,
  buildTotalMonthlyNeed,
} from '@/features/stats/utils/statsReferenceSelectors'

const STATS_REFERENCE_STORAGE_KEY_BASE = 'dashboard_budget:stats_reference_snapshot:v1'
const SNAPSHOT_STALE_AFTER_MS = 5 * 60 * 1000

type StatsReferenceState = {
  snapshot: StatsReferenceSnapshot | null
  loading: boolean
  error: string | null
  isHydrated: boolean
  userId: string | null
}

type HydrateOptions = {
  force?: boolean
  period?: Partial<StatsSelectedPeriod>
  userId?: string | null
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

async function restoreSnapshotAsync(userId?: string | null) {
  if (restoreTaskStarted) return
  restoreTaskStarted = true

  const resolvedUserId = await resolveCurrentUserId(userId)
  if (!resolvedUserId) return

  const persistedSnapshot = await readOfflineValue<StatsReferenceSnapshot>(getStorageKey(resolvedUserId))
  if (!persistedSnapshot) return

  setState({
    snapshot: persistedSnapshot,
    isHydrated: true,
    error: null,
    userId: resolvedUserId,
  })
}

function buildSelectedPeriod(
  fallbackPeriod: { id: string | null; period_year: number; period_month: number; label: string | null } | null,
  override?: Partial<StatsSelectedPeriod>,
): StatsSelectedPeriod {
  const rawId = override?.id ?? fallbackPeriod?.id ?? null

  return {
    id: isValidUuid(rawId) ? rawId : null,
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
      const periodCandidate = resolvePeriodFromStateOrInput(options.period)
      const latestUsablePeriod = await getLatestUsableStatsPeriod()

      let selectedPeriodSource = latestUsablePeriod

      if (periodCandidate.periodYear && periodCandidate.periodMonth) {
        const candidatePeriodExists = await hasUsableStatsPeriod(periodCandidate.periodYear, periodCandidate.periodMonth)
        if (candidatePeriodExists) {
          selectedPeriodSource = {
            id: periodCandidate.id ?? null,
            period_year: periodCandidate.periodYear,
            period_month: periodCandidate.periodMonth,
            label: periodCandidate.label ?? null,
          }
        }
      }

      const selectedPeriod = buildSelectedPeriod(selectedPeriodSource, undefined)

      if (!selectedPeriod.periodYear || !selectedPeriod.periodMonth) {
        throw new Error('Impossible de déterminer la période Stats exploitable à hydrater.')
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
