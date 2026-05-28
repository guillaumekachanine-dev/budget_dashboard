import { budgetDb } from '@/lib/supabaseBudget'
import type { AnalyticsMonthlyMetrics } from '@/lib/types'
import {
  EXPENSE_BUCKETS,
  assertNoNonExpenseBucketsInExpenseTotal,
  isExpenseBucket,
} from '@/features/annual-analysis/components/_constants'

type RawMonthlyBucketActualRow = {
  month_start: string | null
  budget_bucket: string | null
  expense_amount: number | string | null
  revenue_amount: number | string | null
  net_amount: number | string | null
}

function asNumber(value: number | string | null | undefined): number {
  const numeric = Number(value ?? 0)
  return Number.isFinite(numeric) ? numeric : 0
}

function round2(value: number): number {
  return Math.round(value * 100) / 100
}

type MonthlyMetricAccumulator = {
  month_start: string
  period_year: number
  period_month: number
  variable_expense_total: number
  fixed_expense_total: number
  expense_total: number
  income_total: number
}

function createAccumulator(monthStart: string): MonthlyMetricAccumulator {
  const periodYear = Number(monthStart.slice(0, 4))
  const periodMonth = Number(monthStart.slice(5, 7))

  return {
    month_start: monthStart,
    period_year: Number.isFinite(periodYear) ? periodYear : 0,
    period_month: Number.isFinite(periodMonth) ? periodMonth : 0,
    variable_expense_total: 0,
    fixed_expense_total: 0,
    expense_total: 0,
    income_total: 0,
  }
}

/**
 * Source canonique des métriques mensuelles: v_monthly_bucket_actuals_clean.
 * REGLE: l'épargne (flow_type='savings') n'entre jamais dans expense_total.
 */
export async function getMonthlyMetrics(year?: number): Promise<AnalyticsMonthlyMetrics[]> {
  let query = budgetDb
    .from('v_monthly_bucket_actuals_clean')
    .select('month_start, budget_bucket, expense_amount, revenue_amount, net_amount')
    .in('budget_bucket', ['revenu', ...EXPENSE_BUCKETS])
    .order('month_start', { ascending: true })
    .order('budget_bucket', { ascending: true })

  if (typeof year === 'number') {
    query = query
      .gte('month_start', `${year}-01-01`)
      .lt('month_start', `${year + 1}-01-01`)
  }

  const { data, error } = await query

  if (error) {
    throw new Error(`getMonthlyMetrics failed: ${error.message}`)
  }

  const byMonth = new Map<string, MonthlyMetricAccumulator>()
  const includedBucketsInExpenseTotal: string[] = []

  for (const row of (data ?? []) as RawMonthlyBucketActualRow[]) {
    const monthStart = String(row.month_start ?? '').slice(0, 10)
    if (!monthStart || monthStart.length < 7) continue

    const bucket = String(row.budget_bucket ?? '').trim()

    let acc = byMonth.get(monthStart)
    if (!acc) {
      acc = createAccumulator(monthStart)
      byMonth.set(monthStart, acc)
    }

    if (bucket === 'revenu') {
      const incomeAmount = asNumber(row.revenue_amount ?? row.net_amount)
      acc.income_total += Math.max(0, incomeAmount)
      continue
    }

    includedBucketsInExpenseTotal.push(bucket)
    if (!isExpenseBucket(bucket)) continue

    const expenseAmount = Math.abs(asNumber(row.expense_amount ?? row.net_amount))
    acc.expense_total += expenseAmount

    if (bucket === 'socle_fixe') {
      acc.fixed_expense_total += expenseAmount
    } else {
      // "Variable" = toutes les dépenses hors socle fixe.
      acc.variable_expense_total += expenseAmount
    }
  }

  assertNoNonExpenseBucketsInExpenseTotal(includedBucketsInExpenseTotal, 'getMonthlyMetrics:expense_total')

  const refreshedAt = new Date().toISOString()

  return [...byMonth.values()]
    .sort((a, b) => a.month_start.localeCompare(b.month_start))
    .map((row) => ({
      month_start: row.month_start,
      period_year: row.period_year,
      period_month: row.period_month,
      variable_expense_total: round2(row.variable_expense_total),
      fixed_expense_total: round2(row.fixed_expense_total),
      expense_total: round2(row.expense_total),
      income_total: round2(row.income_total),
      savings_capacity_observed: round2(row.income_total - row.expense_total),
      refreshed_at: refreshedAt,
    })) as AnalyticsMonthlyMetrics[]
}
