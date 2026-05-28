import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'
import { QK, STALE } from '@/lib/queryKeys'
import type { TripCockpitRow } from '@/lib/types'
import { getTripCockpit } from '../api/getTripCockpit'

/**
 * Sélectionne le voyage "actif par défaut" à afficher dans le cockpit :
 *   1. Voyage en cours  (trip_status === 'ongoing')
 *   2. Prochain voyage  (premier futur par start_date)
 *   3. Dernier voyage passé (plus récent par end_date)
 *
 * Fonction pure exportée séparément pour faciliter les tests.
 * Repose sur trip_status calculé par la vue DB (CURRENT_DATE côté Postgres)
 * plutôt que sur une comparaison client-side, pour cohérence avec les totaux.
 */
export function selectDefaultTrip(trips: TripCockpitRow[]): TripCockpitRow | null {
  if (trips.length === 0) return null

  const ongoing = trips.find(t => t.trip_status === 'ongoing')
  if (ongoing) return ongoing

  const upcoming = trips
    .filter(t => t.trip_status === 'future')
    .sort((a, b) => a.start_date.localeCompare(b.start_date))[0]
  if (upcoming) return upcoming

  return (
    trips
      .filter(t => t.trip_status === 'past')
      .sort((a, b) => b.end_date.localeCompare(a.end_date))[0] ?? null
  )
}

export function useTripCockpit() {
  const query = useQuery({
    queryKey: [QK.TRIP_COCKPIT],
    queryFn:  getTripCockpit,
    staleTime: STALE.ANALYTICS,
  })

  const rows = useMemo(() => query.data ?? [], [query.data])

  // Voyages futurs triés par date de départ croissante
  const upcomingTrips = useMemo(
    () =>
      rows
        .filter(t => t.trip_status === 'future')
        .sort((a, b) => a.start_date.localeCompare(b.start_date)),
    [rows],
  )

  // Voyage en cours — au plus un possible (v_trip_cockpit garantit l'unicité)
  const activeTrip = useMemo(
    () => rows.find(t => t.trip_status === 'ongoing') ?? null,
    [rows],
  )

  // Voyages passés triés par date de fin décroissante (le plus récent en premier)
  const recentCompletedTrips = useMemo(
    () =>
      rows
        .filter(t => t.trip_status === 'past')
        .sort((a, b) => b.end_date.localeCompare(a.end_date)),
    [rows],
  )

  // Voyage sélectionné par défaut: ongoing > prochain > dernier passé
  const selectedTrip = useMemo(() => selectDefaultTrip(rows), [rows])

  return {
    allTrips:             rows,
    upcomingTrips,
    activeTrip,
    recentCompletedTrips,
    selectedTrip,
    isLoading: query.isLoading,
    error:     query.error ?? null,
    refetch:   query.refetch,
  }
}
