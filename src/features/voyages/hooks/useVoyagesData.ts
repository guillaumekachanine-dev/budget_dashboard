import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'
import { useCategories } from '@/hooks/useCategories'
import { getTrips, getTripTransactions } from '../api/getVoyagesData'
import type { TripWithStats, YearlyVoyagesStats, TripCategoryBreakdown } from '../types'

function dateDiffDays(start: string, end: string): number {
  const a = new Date(`${start}T00:00:00`)
  const b = new Date(`${end}T00:00:00`)
  return Math.max(1, Math.round((b.getTime() - a.getTime()) / 86_400_000) + 1)
}

function stripVoyageSuffix(name: string): string {
  return name.replace(/\s+voyage$/i, '').trim()
}

export function useVoyagesData(year: number) {
  const { data: categories = [] } = useCategories()

  const categoryById = useMemo(
    () => new Map(categories.map((c) => [c.id, c])),
    [categories],
  )

  const tripsQuery = useQuery({
    queryKey: ['voyages', 'trips', year],
    queryFn: () => getTrips(year),
    staleTime: 5 * 60_000,
  })

  const trips = tripsQuery.data ?? []
  const tripIds = useMemo(() => trips.map((t) => t.id), [trips])

  const txQuery = useQuery({
    queryKey: ['voyages', 'transactions', tripIds],
    queryFn: () => getTripTransactions(tripIds),
    enabled: tripIds.length > 0,
    staleTime: 5 * 60_000,
  })

  const txRows = txQuery.data ?? []

  const tripsWithStats = useMemo<TripWithStats[]>(() => {
    const txByTrip = new Map<string, typeof txRows>()
    for (const tx of txRows) {
      const list = txByTrip.get(tx.trip_id) ?? []
      list.push(tx)
      txByTrip.set(tx.trip_id, list)
    }

    const raw = trips.map((trip) => {
      const tripTxs = txByTrip.get(trip.id) ?? []
      const total = tripTxs.reduce((sum, tx) => sum + Number(tx.amount), 0)
      const duration = dateDiffDays(trip.start_date, trip.end_date)
      const avgPerDay = duration > 0 ? total / duration : 0

      const byCatMap = new Map<string, { amount: number; txCount: number }>()
      for (const tx of tripTxs) {
        const catId = tx.category_id ?? '__unknown__'
        const existing = byCatMap.get(catId) ?? { amount: 0, txCount: 0 }
        existing.amount += Number(tx.amount)
        existing.txCount += 1
        byCatMap.set(catId, existing)
      }

      const byCategory: TripCategoryBreakdown[] = Array.from(byCatMap.entries())
        .map(([catId, { amount, txCount }]) => {
          const cat = categoryById.get(catId)
          return {
            categoryId: catId,
            categoryName: cat ? stripVoyageSuffix(cat.name) : 'Autre',
            amount,
            pct: total > 0 ? (amount / total) * 100 : 0,
            txCount,
          }
        })
        .sort((a, b) => b.amount - a.amount)

      return {
        trip,
        total,
        duration,
        avgPerDay,
        txCount: tripTxs.length,
        byCategory,
        rankByAvgPerDay: 0,
        hasData: tripTxs.length > 0,
      }
    })

    const sorted = [...raw].sort((a, b) => b.avgPerDay - a.avgPerDay)
    sorted.forEach((item, i) => { item.rankByAvgPerDay = i + 1 })

    return raw.map((item) => {
      const found = sorted.find((s) => s.trip.id === item.trip.id)
      return { ...item, rankByAvgPerDay: found?.rankByAvgPerDay ?? 0 }
    })
  }, [trips, txRows, categoryById])

  const yearlyStats = useMemo<YearlyVoyagesStats>(() => {
    const total = tripsWithStats.reduce((sum, t) => sum + t.total, 0)
    return {
      year,
      total,
      monthlyAvg: total / 12,
      tripCount: tripsWithStats.length,
      tripsWithData: tripsWithStats.filter((t) => t.hasData).length,
    }
  }, [tripsWithStats, year])

  return {
    trips,
    tripsWithStats,
    yearlyStats,
    isLoading: tripsQuery.isLoading || (tripIds.length > 0 && txQuery.isLoading),
    error: tripsQuery.error ?? txQuery.error ?? null,
  }
}
