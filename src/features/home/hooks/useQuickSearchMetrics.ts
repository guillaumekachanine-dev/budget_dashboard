import { useQuery } from '@tanstack/react-query'
import { budgetDb } from '@/lib/supabaseBudget'

export interface QuickSearchPeriod {
  year: number
  month?: number // undefined means the whole year
}

export interface QuickSearchSelection {
  kind: 'all' | 'category' | 'socle'
  id: string // category UUID, socle key, or 'all_categories'
}

export interface QuickSearchMetricsData {
  consomme: number | null
  budget: number
  average6m: number | null
  ytdDiffAmount: number | null
  ytdDiffPct: number | null
  evolution3mAmount: number | null
  evolution3mPct: number | null
  isFuturePeriod: boolean
}

// Preceding 6 months calculator
function getPreceding6Months(year: number, month: number): Array<{ year: number; month: number }> {
  const result: Array<{ year: number; month: number }> = []
  let currYear = year
  let currMonth = month

  for (let i = 0; i < 6; i++) {
    currMonth -= 1
    if (currMonth < 1) {
      currMonth = 12
      currYear -= 1
    }
    result.push({ year: currYear, month: currMonth })
  }
  return result
}

export function useQuickSearchMetrics(
  selection: QuickSearchSelection | null,
  period: QuickSearchPeriod | null,
  enabled = false
) {
  return useQuery({
    queryKey: ['quick-search-metrics', selection, period],
    enabled: enabled && !!selection && !!period,
    queryFn: async (): Promise<QuickSearchMetricsData> => {
      if (!selection || !period) throw new Error('Paramètres manquants')

      const targetYear = period.year
      const targetMonth = period.month

      // Detect if the chosen period is in the future
      const now = new Date()
      const currentYear = now.getFullYear()
      const currentMonth = now.getMonth() + 1

      const isFuturePeriod =
        targetYear > currentYear || (targetYear === currentYear && targetMonth !== undefined && targetMonth > currentMonth)

      // Fetch categories list to join if needed
      const { data, error: catError } = await budgetDb
        .from('categories')
        .select('id, name, parent_id')
      if (catError) throw new Error(`Categories fetch failed: ${catError.message}`)
      const categories = data || []

      // Get category ID set for parent categories
      const getChildCategoryIds = (parentId: string): string[] => {
        const ids = [parentId]
        categories.forEach((cat) => {
          if (cat.parent_id === parentId) {
            ids.push(cat.id)
          }
        })
        return ids
      }

      // Initialize actuals and budgets maps
      // Map key format: "year:month" -> value
      const actualsMap = new Map<string, number>()
      const budgetsMap = new Map<string, number>()

      if (selection.kind === 'category') {
        const catIds = getChildCategoryIds(selection.id)

        // 1. Fetch category actuals for 2025 and 2026
        const { data: actualsData, error: actualsError } = await budgetDb
          .from('v_monthly_category_actuals_clean' as never)
          .select('period_year, period_month, category_id, actual_amount')
          .in('period_year', [2025, 2026])
          .in('category_id', catIds)

        if (actualsError) throw new Error(`Category actuals fetch failed: ${actualsError.message}`)

        actualsData?.forEach((row: any) => {
          const key = `${row.period_year}:${row.period_month}`
          const val = Number(row.actual_amount ?? 0)
          actualsMap.set(key, (actualsMap.get(key) ?? 0) + val)
        })

        // 2. Fetch budgets for the category
        // First get the period IDs mapped to years/months
        const { data: periodsData, error: periodsError } = await budgetDb
          .from('budget_periods')
          .select('id, period_year, period_month')
          .in('period_year', [2025, 2026])

        if (periodsError) throw new Error(`Budget periods fetch failed: ${periodsError.message}`)

        const periodIdToKey = new Map<string, string>()
        periodsData?.forEach((p: any) => {
          periodIdToKey.set(p.id, `${p.period_year}:${p.period_month}`)
        })

        const periodIds = periodsData?.map((p: any) => p.id) ?? []

        if (periodIds.length > 0) {
          const { data: budgetsData, error: budgetsError } = await budgetDb
            .from('budgets')
            .select('period_id, category_id, amount')
            .eq('budget_kind', 'category')
            .in('period_id', periodIds)
            .in('category_id', catIds)

          if (budgetsError) throw new Error(`Budgets fetch failed: ${budgetsError.message}`)

          budgetsData?.forEach((b: any) => {
            const key = periodIdToKey.get(b.period_id)
            if (key) {
              const val = Number(b.amount ?? 0)
              budgetsMap.set(key, (budgetsMap.get(key) ?? 0) + val)
            }
          })
        }
      } else {
        // Selection is either 'socle' (bucket) or 'all' (Toutes catégories)
        // Fetch budget_bucket_budget_vs_actual_by_month
        let query = budgetDb
          .from('budget_bucket_budget_vs_actual_by_month')
          .select('period_year, period_month, budget_bucket, target_budget_bucket_eur, actual_budget_bucket_eur')
          .in('period_year', [2025, 2026])

        if (selection.kind === 'socle') {
          query = query.eq('budget_bucket', selection.id)
        } else {
          // 'all' -> only sum expense buckets (exclude revenue and savings)
          const expenseBuckets = ['socle_fixe', 'variable_essentielle', 'provision', 'voyage', 'discretionnaire']
          query = query.in('budget_bucket', expenseBuckets)
        }

        const { data: bucketData, error: bucketError } = await query
        if (bucketError) throw new Error(`Bucket metrics fetch failed: ${bucketError.message}`)

        bucketData?.forEach((row: any) => {
          const key = `${row.period_year}:${row.period_month}`
          const act = Number(row.actual_budget_bucket_eur ?? 0)
          const bud = Number(row.target_budget_bucket_eur ?? 0)

          actualsMap.set(key, (actualsMap.get(key) ?? 0) + act)
          budgetsMap.set(key, (budgetsMap.get(key) ?? 0) + bud)
        })
      }

      // --- CALCULATE KPIs ---

      // 1. Consomme
      let consomme: number | null = null
      if (!isFuturePeriod) {
        if (targetMonth !== undefined) {
          // Specific month
          consomme = actualsMap.get(`${targetYear}:${targetMonth}`) ?? 0
        } else {
          // Full year -> sum up to current month (YTD) for the chosen year
          let sum = 0
          const maxMonth = targetYear === currentYear ? currentMonth : 12
          for (let m = 1; m <= maxMonth; m++) {
            sum += actualsMap.get(`${targetYear}:${m}`) ?? 0
          }
          consomme = sum
        }
      }

      // 2. Budget
      let budget = 0
      if (targetMonth !== undefined) {
        budget = budgetsMap.get(`${targetYear}:${targetMonth}`) ?? 0
      } else {
        // Full year -> sum of all 12 months budget
        for (let m = 1; m <= 12; m++) {
          budget += budgetsMap.get(`${targetYear}:${m}`) ?? 0
        }
      }

      // 3. Moyenne 6M
      // Preceding 6 months from the selected period (or up to now if full year)
      let average6m: number | null = null
      const anchorMonth = targetMonth !== undefined ? targetMonth : (targetYear === currentYear ? currentMonth : 12)
      const anchorYear = targetYear
      const precedingMonths = getPreceding6Months(anchorYear, anchorMonth)

      let sum6m = 0
      let count6m = 0
      precedingMonths.forEach(({ year, month }) => {
        // Only average populated/past months
        const isFuture = year > currentYear || (year === currentYear && month > currentMonth)
        if (!isFuture) {
          sum6m += actualsMap.get(`${year}:${month}`) ?? 0
          count6m++
        }
      })
      average6m = count6m > 0 ? sum6m / count6m : null

      // 4. Year to Year comparison (kept for backwards compat, not displayed)
      let ytdDiffAmount: number | null = null
      let ytdDiffPct: number | null = null

      const compareYear = targetYear === 2026 ? 2025 : 2026
      if (targetMonth !== undefined) {
        const currentVal = isFuturePeriod ? budget : (actualsMap.get(`${targetYear}:${targetMonth}`) ?? 0)
        const compareVal = actualsMap.get(`${compareYear}:${targetMonth}`) ?? 0
        ytdDiffAmount = currentVal - compareVal
        ytdDiffPct = compareVal > 0 ? (ytdDiffAmount / compareVal) * 100 : null
      } else {
        const maxMonth = targetYear === currentYear ? currentMonth : 12
        let currentSum = 0
        let compareSum = 0
        for (let m = 1; m <= maxMonth; m++) {
          currentSum += actualsMap.get(`${targetYear}:${m}`) ?? 0
          compareSum += actualsMap.get(`${compareYear}:${m}`) ?? 0
        }
        ytdDiffAmount = currentSum - compareSum
        ytdDiffPct = compareSum > 0 ? (ytdDiffAmount / compareSum) * 100 : null
      }

      // 5. Évolution 3M
      // Recent window  = anchor month + 2 months before it (3 months)
      // Previous window = 3 months before the recent window
      const anchor3mMonth = targetMonth !== undefined ? targetMonth : (targetYear === currentYear ? currentMonth : 12)
      const anchor3mYear = targetYear

      function step3m(y: number, m: number, steps: number): { year: number; month: number } {
        let ry = y, rm = m
        for (let i = 0; i < steps; i++) {
          rm -= 1
          if (rm < 1) { rm = 12; ry -= 1 }
        }
        return { year: ry, month: rm }
      }

      let recentSum3m = 0
      let prevSum3m = 0

      for (let i = 0; i < 3; i++) {
        const { year: ry, month: rm } = step3m(anchor3mYear, anchor3mMonth, i)
        recentSum3m += actualsMap.get(`${ry}:${rm}`) ?? 0
      }
      for (let i = 3; i < 6; i++) {
        const { year: ry, month: rm } = step3m(anchor3mYear, anchor3mMonth, i)
        prevSum3m += actualsMap.get(`${ry}:${rm}`) ?? 0
      }

      const evolution3mAmount = recentSum3m - prevSum3m
      const evolution3mPct = prevSum3m > 0 ? (evolution3mAmount / prevSum3m) * 100 : null

      return {
        consomme,
        budget,
        average6m,
        ytdDiffAmount,
        ytdDiffPct,
        evolution3mAmount,
        evolution3mPct,
        isFuturePeriod,
      }
    },
    staleTime: 5 * 60_000,
  })
}
