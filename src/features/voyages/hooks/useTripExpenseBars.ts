import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'
import { useCategories } from '@/hooks/useCategories'
import { useAuth } from '@/hooks/useAuth'
import type { TripCockpitRow } from '@/lib/types'
import { budgetDb } from '@/lib/supabaseBudget'
import { useTripExpenses } from './useTripExpenses'
import { useVoyagesData } from './useVoyagesData'

export type TripExpenseBarsMode = 'future' | 'ongoing' | 'default'

export type TripExpenseBarsRow = {
  key: string
  name: string
  budgetAmount: number
  consumedAmount: number
}

function stripVoyageSuffix(name: string): string {
  return name.replace(/\s+voyage$/i, '').trim()
}

function normalizeCategoryLabel(name: string): string {
  return stripVoyageSuffix(name)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
}

export function useTripExpenseBars(selectedTrip: TripCockpitRow | null) {
  const { user } = useAuth()
  const { data: categories = [] } = useCategories()
  const tripId = selectedTrip?.trip_id ?? null
  const selectedYear = useMemo(() => {
    if (!selectedTrip) return new Date().getFullYear()
    return selectedTrip.year || new Date(`${selectedTrip.start_date}T00:00:00`).getFullYear()
  }, [selectedTrip])

  const { categoryBreakdown } = useTripExpenses(tripId)
  const { tripsWithStats } = useVoyagesData(selectedYear)

  const categoryNameById = useMemo(
    () => new Map(categories.map((category) => [category.id, stripVoyageSuffix(category.name)])),
    [categories],
  )

  const selectedTripWithStats = useMemo(
    () => tripsWithStats.find((item) => item.trip.id === tripId) ?? null,
    [tripId, tripsWithStats],
  )

  const { data: plannedCategoryRows = [] } = useQuery({
    queryKey: ['voyages-future-planned-category-rows', user?.id ?? null, tripId, selectedTrip?.name ?? null, selectedTrip?.start_date ?? null, selectedTrip?.end_date ?? null],
    enabled: Boolean(
      user?.id
      && selectedTrip?.trip_status === 'future'
      && selectedTrip?.name
      && selectedTrip?.start_date
      && selectedTrip?.end_date,
    ),
    queryFn: async () => {
      const { data, error } = await budgetDb
        .from('planned_operations')
        .select('category_id, planned_amount')
        .eq('user_id', user!.id)
        .eq('flow_type', 'expense')
        .eq('label', selectedTrip!.name)
        .gte('planned_date', selectedTrip!.start_date)
        .lte('planned_date', selectedTrip!.end_date)
      if (error) throw error
      return (data ?? []) as Array<{ category_id: string | null; planned_amount: number | null }>
    },
    staleTime: 60_000,
  })

  const expenseBars = useMemo(() => {
    const mode: TripExpenseBarsMode = selectedTrip?.trip_status === 'future'
      ? 'future'
      : selectedTrip?.trip_status === 'ongoing'
        ? 'ongoing'
        : 'default'

    const budgetMap = new Map<string, { name: string; amount: number }>()
    if (mode === 'future' && plannedCategoryRows.length > 0) {
      for (const row of plannedCategoryRows) {
        const categoryId = row.category_id ?? ''
        const categoryName = categoryId ? (categoryNameById.get(categoryId) ?? 'Autre') : 'Autre'
        const key = normalizeCategoryLabel(categoryName)
        const amount = Number(row.planned_amount ?? 0)
        if (!key || !Number.isFinite(amount) || amount <= 0) continue
        const current = budgetMap.get(key)
        budgetMap.set(key, { name: stripVoyageSuffix(categoryName), amount: (current?.amount ?? 0) + amount })
      }
    } else {
      for (const row of selectedTripWithStats?.byCategory ?? []) {
        const key = normalizeCategoryLabel(row.categoryName)
        const amount = Number(row.amount ?? 0)
        if (!key || !Number.isFinite(amount) || amount <= 0) continue
        const current = budgetMap.get(key)
        budgetMap.set(key, { name: stripVoyageSuffix(row.categoryName), amount: (current?.amount ?? 0) + amount })
      }
    }

    const consumedMap = new Map<string, { name: string; amount: number }>()
    for (const row of categoryBreakdown) {
      const key = normalizeCategoryLabel(row.categoryName)
      const amount = Number(row.amount ?? 0)
      if (!key || !Number.isFinite(amount) || amount <= 0) continue
      const current = consumedMap.get(key)
      consumedMap.set(key, { name: stripVoyageSuffix(row.categoryName), amount: (current?.amount ?? 0) + amount })
    }

    if (mode === 'future') {
      const rows = [...budgetMap.entries()]
        .map(([key, value]) => ({ key, name: value.name, budgetAmount: value.amount, consumedAmount: 0 }))
        .sort((a, b) => b.budgetAmount - a.budgetAmount)
      return { mode, rows }
    }

    if (mode === 'ongoing') {
      const keys = new Set<string>([...budgetMap.keys(), ...consumedMap.keys()])
      const rows = [...keys]
        .map((key) => {
          const budget = budgetMap.get(key)
          const consumed = consumedMap.get(key)
          return {
            key,
            name: consumed?.name ?? budget?.name ?? key,
            budgetAmount: Number(budget?.amount ?? 0),
            consumedAmount: Number(consumed?.amount ?? 0),
          }
        })
        .filter((row) => row.budgetAmount > 0 || row.consumedAmount > 0)
        .sort((a, b) => b.budgetAmount - a.budgetAmount || b.consumedAmount - a.consumedAmount)
      return { mode, rows }
    }

    const rows = categoryBreakdown
      .map((row) => ({
        key: row.categoryId,
        name: stripVoyageSuffix(row.categoryName),
        budgetAmount: 0,
        consumedAmount: Number(row.amount ?? 0),
      }))
      .sort((a, b) => b.consumedAmount - a.consumedAmount)
    return { mode, rows }
  }, [categoryBreakdown, categoryNameById, plannedCategoryRows, selectedTrip?.trip_status, selectedTripWithStats?.byCategory])

  return expenseBars
}
