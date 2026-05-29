import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'
import { QK, STALE } from '@/lib/queryKeys'
import { getTripExpenses } from '../api/getTripExpenses'
import type { TripCategoryBreakdownFull } from '../types'

export function useTripExpenses(tripId: string | null) {
  const query = useQuery({
    queryKey:  [QK.TRIP_EXPENSES, tripId],
    queryFn:   () => getTripExpenses(tripId!),
    enabled:   Boolean(tripId),
    staleTime: STALE.LIVE,
  })

  const expenses = useMemo(() => query.data ?? [], [query.data])

  const bankExpenses   = useMemo(() => expenses.filter(e => e.source_type === 'bank'),   [expenses])
  const manualExpenses = useMemo(() => expenses.filter(e => e.source_type === 'manual'),  [expenses])
  const recentExpenses = useMemo(() => expenses.slice(0, 15), [expenses])

  // Breakdown par catégorie (js-combine-iterations : un seul parcours)
  const categoryBreakdown = useMemo<TripCategoryBreakdownFull[]>(() => {
    const total = expenses.reduce((s, e) => s + e.amount, 0)
    const map   = new Map<string, { name: string; parent: string | null; amount: number; count: number }>()

    for (const e of expenses) {
      const key  = e.category_id ?? '__unknown__'
      const name = e.category_name ?? 'Autre'
      const existing = map.get(key)
      if (existing) {
        existing.amount += e.amount
        existing.count  += 1
      } else {
        map.set(key, { name, parent: e.parent_category_name, amount: e.amount, count: 1 })
      }
    }

    return [...map.entries()]
      .map(([id, { name, parent, amount, count }]) => ({
        categoryId:         id,
        categoryName:       name,
        parentCategoryName: parent,
        amount,
        pct:   total > 0 ? (amount / total) * 100 : 0,
        count,
      }))
      .sort((a, b) => b.amount - a.amount)
  }, [expenses])

  return {
    expenses,
    bankExpenses,
    manualExpenses,
    recentExpenses,
    categoryBreakdown,
    isLoading: query.isLoading,
    error:     query.error ?? null,
  }
}
