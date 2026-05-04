import { useEffect, useRef } from 'react'
import { useStatsReferenceData } from '@/features/stats/hooks/useStatsReferenceData'
import { isStatsReferenceSnapshotStale } from '@/features/stats/store/statsReferenceStore'
import { refreshBudgetAnalytics } from '@/features/budget/api/refreshBudgetAnalytics'

type StatsReferenceBootstrapProps = {
  userId: string | null
  enabled: boolean
}

export function StatsReferenceBootstrap({ userId, enabled }: StatsReferenceBootstrapProps) {
  const { snapshot, loading, hydrateStatsReferenceData, storeUserId } = useStatsReferenceData()
  const attemptedUsersRef = useRef<Set<string>>(new Set())

  useEffect(() => {
    if (!enabled || !userId) return
    if (loading) return

    const hasFreshSnapshotForUser = storeUserId === userId
      && snapshot !== null
      && !isStatsReferenceSnapshotStale(snapshot)

    if (hasFreshSnapshotForUser) return
    if (attemptedUsersRef.current.has(userId)) return

    attemptedUsersRef.current.add(userId)

    // Immediate hydration — shows data as fast as possible
    void hydrateStatsReferenceData({ userId }).catch(() => {})

    // Background analytics refresh — re-hydrates with fresh data when done
    // Runs concurrently; re-hydration is forced after refresh completes
    void refreshBudgetAnalytics(userId)
      .then(() => hydrateStatsReferenceData({ userId, force: true }))
      .catch(() => {})
  }, [enabled, hydrateStatsReferenceData, loading, snapshot, storeUserId, userId])

  useEffect(() => {
    if (userId) return
    attemptedUsersRef.current.clear()
  }, [userId])

  return null
}
