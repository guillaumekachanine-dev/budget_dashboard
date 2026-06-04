import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'
import { useCategories } from '@/hooks/useCategories'
import { useAuth } from '@/hooks/useAuth'
import type { TripCockpitRow } from '@/lib/types'
import { budgetDb } from '@/lib/supabaseBudget'
import { QK } from '@/lib/queryKeys'
import { useTripExpenses } from './useTripExpenses'

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

  const { categoryBreakdown } = useTripExpenses(tripId)

  const categoryNameById = useMemo(
    () => new Map(categories.map((category) => [category.id, stripVoyageSuffix(category.name)])),
    [categories],
  )

  const { data: plannedCategoryRows = [] } = useQuery({
    queryKey: [QK.VOYAGES_PLANNED_BUDGET_CATEGORIES, user?.id ?? null, tripId, selectedTrip?.name ?? null, selectedTrip?.start_date ?? null, selectedTrip?.end_date ?? null],
    enabled: Boolean(
      user?.id
      && selectedTrip?.name
      && selectedTrip?.start_date
      && selectedTrip?.end_date,
    ),
    queryFn: async () => {
      const { data, error } = await budgetDb
        .from('planned_operations')
        .select('category_id, planned_amount, personal_share_ratio')
        .eq('user_id', user!.id)
        .eq('flow_type', 'expense')
        .eq('label', selectedTrip!.name)
        .gte('planned_date', selectedTrip!.start_date)
        .lte('planned_date', selectedTrip!.end_date)
      if (error) throw error
      return (data ?? []) as Array<{ category_id: string | null; planned_amount: number | null; personal_share_ratio: number | null }>
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
    for (const row of plannedCategoryRows) {
      const categoryId = row.category_id ?? ''
      const categoryName = categoryId ? (categoryNameById.get(categoryId) ?? 'Autre') : 'Autre'
      const key = normalizeCategoryLabel(categoryName)
      const plannedAmount = Number(row.planned_amount ?? 0)
      const personalShareRatio = Number(row.personal_share_ratio ?? 1)
      const amount = plannedAmount * (Number.isFinite(personalShareRatio) ? personalShareRatio : 1)
      if (!key || !Number.isFinite(amount) || amount <= 0) continue
      const current = budgetMap.get(key)
      budgetMap.set(key, { name: stripVoyageSuffix(categoryName), amount: (current?.amount ?? 0) + amount })
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
        .filter((row) => row.budgetAmount > 0)
        .sort((a, b) => b.budgetAmount - a.budgetAmount || b.consumedAmount - a.consumedAmount)
      return { mode, rows }
    }

    const rows = [...budgetMap.entries()]
      .map(([key, value]) => ({
        key,
        name: value.name,
        budgetAmount: value.amount,
        consumedAmount: Number(consumedMap.get(key)?.amount ?? 0),
      }))
      .sort((a, b) => b.budgetAmount - a.budgetAmount)
    return { mode, rows }
  }, [categoryBreakdown, categoryNameById, plannedCategoryRows, selectedTrip?.trip_status])

  return expenseBars
}
