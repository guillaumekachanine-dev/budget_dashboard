import { useQuery } from '@tanstack/react-query'
import { QK, STALE } from '@/lib/queryKeys'
import { getAllTrips } from '../api/getVoyagesData'
import type { Trip } from '../types'

export function useAllTrips(): { trips: Trip[]; isLoading: boolean } {
  const query = useQuery({
    queryKey: [QK.VOYAGES_ALL],
    queryFn: getAllTrips,
    staleTime: STALE.ANALYTICS,
  })
  return { trips: query.data ?? [], isLoading: query.isLoading }
}
