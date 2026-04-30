import {
  clearSnapshot,
  hydrateStatsReferenceData,
  setSelectedPeriod,
  useStatsReferenceSnapshot,
  useStatsReferenceStore,
} from '@/features/stats/store/statsReferenceStore'

export function useStatsReferenceData() {
  const { snapshot, loading, error, isHydrated } = useStatsReferenceStore()

  return {
    snapshot,
    loading,
    error,
    isHydrated,
    hydrateStatsReferenceData,
    setSelectedPeriod,
    clearSnapshot,
  }
}

export { useStatsReferenceSnapshot }
