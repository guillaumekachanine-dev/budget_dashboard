import { useQuery } from '@tanstack/react-query'
import { QK, STALE } from '@/lib/queryKeys'
import { getTripsForMonth } from '../api/getTripsForMonth'

export function useTripsForMonth(year: number, month: number) {
  return useQuery({
    queryKey: [QK.TRIPS_FOR_MONTH, year, month],
    queryFn: () => getTripsForMonth(year, month),
    staleTime: STALE.ANALYTICS,
  })
}
