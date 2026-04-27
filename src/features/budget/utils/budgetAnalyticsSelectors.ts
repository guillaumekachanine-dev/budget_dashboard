import type {
  AnalyticsMonthlyCategoryMetrics,
  AnalyticsMonthlyMetrics,
  AnalyticsVariableCategorySummary,
} from '@/lib/types'

type VariableBreakdownRow = {
  categoryId: string
  categoryName: string
  amount: number
  pctOfMonthVariable: number
}

type BudgetInsights = {
  mainCategory: AnalyticsVariableCategorySummary | null
  mostVolatileCategory: (AnalyticsVariableCategorySummary & { volatility: number }) | null
  mostRecurringCategory: AnalyticsVariableCategorySummary | null
}

function asNumber(value: number): number {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

export function formatCurrency(value: number, currency = 'EUR'): string {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(asNumber(value))
}

export function formatDateTime(value: string | null): string {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString('fr-FR')
}

export function getLatestMonthMetrics(
  monthlyMetrics: AnalyticsMonthlyMetrics[],
): AnalyticsMonthlyMetrics | null {
  if (monthlyMetrics.length === 0) return null
  const ordered = [...monthlyMetrics].sort((a, b) => a.month_start.localeCompare(b.month_start))
  return ordered[ordered.length - 1] ?? null
}

export function getPreviousMonthMetrics(
  monthlyMetrics: AnalyticsMonthlyMetrics[],
): AnalyticsMonthlyMetrics | null {
  if (monthlyMetrics.length < 2) return null
  const ordered = [...monthlyMetrics].sort((a, b) => a.month_start.localeCompare(b.month_start))
  return ordered[ordered.length - 2] ?? null
}

export function computeDeltaPct(currentValue: number, previousValue: number | null | undefined): number | null {
  const previous = previousValue == null ? null : asNumber(previousValue)
  if (previous == null || previous === 0) return null
  return ((asNumber(currentValue) - previous) / previous) * 100
}

export function getTopVariableCategories(
  variableCategorySummary: AnalyticsVariableCategorySummary[],
  limit = 5,
): Array<AnalyticsVariableCategorySummary & { pctOfVariableTotal: number }> {
  if (variableCategorySummary.length === 0) return []
  const ordered = [...variableCategorySummary].sort((a, b) => asNumber(b.total_amount) - asNumber(a.total_amount))
  const total = ordered.reduce((sum, row) => sum + asNumber(row.total_amount), 0)
  return ordered.slice(0, limit).map((row) => ({
    ...row,
    pctOfVariableTotal: total > 0 ? (asNumber(row.total_amount) / total) * 100 : 0,
  }))
}

export function getLatestMonthVariableBreakdown(
  monthlyVariableCategories: AnalyticsMonthlyCategoryMetrics[],
  limit = 7,
): VariableBreakdownRow[] {
  if (monthlyVariableCategories.length === 0) return []

  const latestMonthStart = [...monthlyVariableCategories]
    .sort((a, b) => a.month_start.localeCompare(b.month_start))
    .slice(-1)[0]?.month_start

  if (!latestMonthStart) return []

  const monthRows = monthlyVariableCategories.filter((row) => row.month_start === latestMonthStart)
  const grouped = new Map<string, { categoryName: string; amount: number }>()

  monthRows.forEach((row) => {
    const existing = grouped.get(row.category_id)
    const amount = asNumber(row.amount_total)
    if (!existing) {
      grouped.set(row.category_id, { categoryName: row.category_name, amount })
      return
    }
    existing.amount += amount
  })

  const rows = [...grouped.entries()].map(([categoryId, value]) => ({
    categoryId,
    categoryName: value.categoryName,
    amount: value.amount,
  }))

  const totalVariableMonth = rows.reduce((sum, row) => sum + row.amount, 0)

  return rows
    .sort((a, b) => b.amount - a.amount)
    .slice(0, limit)
    .map((row) => ({
      ...row,
      pctOfMonthVariable: totalVariableMonth > 0 ? (row.amount / totalVariableMonth) * 100 : 0,
    }))
}

export function getBudgetInsights(
  variableCategorySummary: AnalyticsVariableCategorySummary[],
): BudgetInsights {
  if (variableCategorySummary.length === 0) {
    return {
      mainCategory: null,
      mostVolatileCategory: null,
      mostRecurringCategory: null,
    }
  }

  const orderedByTotal = [...variableCategorySummary].sort((a, b) => asNumber(b.total_amount) - asNumber(a.total_amount))
  const orderedByRecurring = [...variableCategorySummary].sort(
    (a, b) => asNumber(b.active_months_count) - asNumber(a.active_months_count),
  )
  const orderedByVolatility = [...variableCategorySummary]
    .map((row) => ({ ...row, volatility: asNumber(row.max_monthly_amount) - asNumber(row.min_monthly_amount) }))
    .sort((a, b) => b.volatility - a.volatility)

  return {
    mainCategory: orderedByTotal[0] ?? null,
    mostVolatileCategory: orderedByVolatility[0] ?? null,
    mostRecurringCategory: orderedByRecurring[0] ?? null,
  }
}
