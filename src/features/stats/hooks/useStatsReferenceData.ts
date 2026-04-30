import {
  clearSnapshot,
  hydrateStatsReferenceData,
  setSelectedPeriod,
  useStatsReferenceSnapshot,
  useStatsReferenceStore,
} from '@/features/stats/store/statsReferenceStore'

export function useStatsReferenceData() {
  const { snapshot, loading, error, isHydrated, userId } = useStatsReferenceStore()

  return {
    snapshot,
    loading,
    error,
    isHydrated,
    storeUserId: userId,
    hydrateStatsReferenceData,
    setSelectedPeriod,
    clearSnapshot,
  }
}

export { useStatsReferenceSnapshot }
