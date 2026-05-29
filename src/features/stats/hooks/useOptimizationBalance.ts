import { useMemo } from 'react'
import { useOptimizationCapacity } from './useOptimizationCapacity'
import { useBudgetSummaries } from '@/hooks/useBudgets'
import { getCurrentPeriod } from '@/lib/utils'

export function useOptimizationBalance(
  customBudgetByCategory?: Map<string, number> | null,
  customActualByCategory?: Map<string, number> | null,
  customMonth?: number | null
) {
  const { year: currentYear, month: currentMonth } = getCurrentPeriod()
  const targetMonth = customMonth ?? currentMonth

  // Levers are always loaded for the active/target year (2026)
  const { data: capacityData, isLoading: loadingCapacity } = useOptimizationCapacity(2026)
  
  // Load current period summaries if no custom maps are provided
  const needsDefaultSummaries = !customBudgetByCategory || !customActualByCategory
  const { data: defaultSummaries, isLoading: loadingSummaries } = useBudgetSummaries(
    currentYear,
    targetMonth
  )

  const balance = useMemo(() => {
    const levers = capacityData?.optimization_levers ?? []
    const displayedLevers = levers.slice(0, 8)
    if (displayedLevers.length === 0) return 0

    const normalizeCategoryKey = (value: string | null | undefined) => (value ?? '')
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .trim()

    let budgetMap = customBudgetByCategory
    let actualMap = customActualByCategory

    if (needsDefaultSummaries && defaultSummaries) {
      const bMap = new Map<string, number>()
      const aMap = new Map<string, number>()
      for (const s of defaultSummaries) {
        const key = normalizeCategoryKey(s.category.name)
        bMap.set(key, s.budget_amount)
        aMap.set(key, s.spent_amount)
      }
      budgetMap = bMap
      actualMap = aMap
    }

    if (!budgetMap || !actualMap) return 0

    let totalOptimisations = 0
    let totalDepassements = 0

    displayedLevers.forEach((lever) => {
      const catKey = normalizeCategoryKey(lever.category_name)
      const categoryBudget = budgetMap!.get(catKey) ?? null
      const categoryActual = actualMap!.get(catKey) ?? null

      const monthlyGain = Math.max(0, Number(lever.realistic_monthly_gain ?? 0))
      const monthlyAvg = Number(lever.avg_monthly_amount_6m ?? 0)
      const budget = categoryBudget ?? (monthlyAvg > 0 ? monthlyAvg : null)
      const spendObjective = budget != null ? Math.max(0, budget - monthlyGain) : null

      if (categoryActual != null && spendObjective != null && budget != null) {
        if (categoryActual <= spendObjective) {
          totalOptimisations += (budget - categoryActual)
        } else {
          totalDepassements += (categoryActual - spendObjective)
        }
      }
    })

    return totalOptimisations - totalDepassements
  }, [
    capacityData?.optimization_levers,
    customBudgetByCategory,
    customActualByCategory,
    needsDefaultSummaries,
    defaultSummaries,
  ])

  return {
    balance,
    isLoading: loadingCapacity || (needsDefaultSummaries && loadingSummaries),
  }
}
