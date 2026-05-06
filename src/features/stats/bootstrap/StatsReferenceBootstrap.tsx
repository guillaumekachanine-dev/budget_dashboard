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

    // Étape 1 : hydratation immédiate depuis le cache IndexedDB ou la DB
    void hydrateStatsReferenceData({ userId }).catch(() => {})

    // Étape 2 : refresh analytics différé pour libérer la fenêtre initiale
    // La page Home a ~3s pour charger ses données avant que le RPC lourd parte
    const timer = setTimeout(() => {
      void refreshBudgetAnalytics(userId)
        .then(() => hydrateStatsReferenceData({ userId, force: true }))
        .catch(() => {})
    }, 3000)

    return () => clearTimeout(timer)
  }, [enabled, hydrateStatsReferenceData, loading, snapshot, storeUserId, userId])

  useEffect(() => {
    if (userId) return
    attemptedUsersRef.current.clear()
  }, [userId])

  return null
}
