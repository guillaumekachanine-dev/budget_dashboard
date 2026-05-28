import { budgetDb } from '@/lib/supabaseBudget'
import type { YtdFlowRow } from '@/features/annual-analysis/types.compared'
import { COMPARED_MONTHS, COMPARED_YEARS } from '@/features/annual-analysis/types.compared'
import {
  assertNoNonExpenseBucketsInExpenseTotal,
  isExpenseBucket,
} from '@/features/annual-analysis/components/_constants'

type RawSavingsRow = {
  transaction_date: string | null
  amount: number | string | null
}

type RawBucketMonthlyRow = {
  month_start: string | null
  budget_bucket: string | null
  expense_amount: number | string | null
  revenue_amount: number | string | null
  net_amount: number | string | null
}

function buildPeriodKey(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, '0')}`
}

function extractYearMonth(dateValue: string | null): { year: number; month: number } | null {
  if (!dateValue) return null
  const trimmed = dateValue.trim()
  if (trimmed.length < 7) return null
  const year = Number(trimmed.slice(0, 4))
  const month = Number(trimmed.slice(5, 7))
  if (!Number.isFinite(year) || !Number.isFinite(month)) return null
  if (month < 1 || month > 12) return null
  return { year, month }
}

/**
 * Flux globaux mensuels pour 2025 et 2026, filtrés sur Jan-Avr.
 * Épargne = montants réellement versés (transactions flow_type = savings),
 * et non la "capacité d'épargne observée".
 */
export async function getComparedYtdFlows(): Promise<YtdFlowRow[]> {
  const minYear = Math.min(...COMPARED_YEARS)
  const maxYear = Math.max(...COMPARED_YEARS)
  const allowedYears = new Set<number>(COMPARED_YEARS as readonly number[])
  const allowedMonths = new Set<number>(COMPARED_MONTHS as readonly number[])

  const [bucketMonthlyRes, savingsRes] = await Promise.all([
    budgetDb
      .from('v_monthly_bucket_actuals_clean')
      .select('month_start, budget_bucket, expense_amount, revenue_amount, net_amount')
      .gte('month_start', `${minYear}-01-01`)
      .lt('month_start', `${maxYear + 1}-01-01`)
      .order('month_start', { ascending: true })
      .order('budget_bucket', { ascending: true }),
    budgetDb
      .from('transactions')
      .select('transaction_date, amount')
      .eq('flow_type', 'savings')
      .eq('is_hidden', false)
      .gte('transaction_date', `${minYear}-01-01`)
      .lt('transaction_date', `${maxYear + 1}-01-01`)
      .order('transaction_date', { ascending: true }),
  ])

  if (bucketMonthlyRes.error) throw new Error(`getComparedYtdFlows (bucket actuals): ${bucketMonthlyRes.error.message}`)
  if (savingsRes.error) throw new Error(`getComparedYtdFlows (savings): ${savingsRes.error.message}`)

  const expenseByPeriod = new Map<string, number>()
  const fixedByPeriod = new Map<string, number>()
  const variableByPeriod = new Map<string, number>()
  const incomeByPeriod = new Map<string, number>()
  const includedBucketsInExpenseTotal: string[] = []

  for (const row of (bucketMonthlyRes.data ?? []) as RawBucketMonthlyRow[]) {
    const parsed = extractYearMonth(row.month_start)
    if (!parsed) continue
    if (!allowedYears.has(parsed.year) || !allowedMonths.has(parsed.month)) continue

    const bucket = String(row.budget_bucket ?? '').trim()
    const key = buildPeriodKey(parsed.year, parsed.month)

    if (bucket === 'revenu') {
      const incomeAmount = Number(row.revenue_amount ?? row.net_amount ?? 0)
      if (!Number.isFinite(incomeAmount)) continue
      incomeByPeriod.set(key, (incomeByPeriod.get(key) ?? 0) + incomeAmount)
      continue
    }

    includedBucketsInExpenseTotal.push(bucket)
    if (!isExpenseBucket(bucket)) continue

    const expenseAmount = Number(row.expense_amount ?? row.net_amount ?? 0)
    if (!Number.isFinite(expenseAmount)) continue
    const safeExpense = Math.abs(expenseAmount)

    expenseByPeriod.set(key, (expenseByPeriod.get(key) ?? 0) + safeExpense)
    if (bucket === 'socle_fixe') {
      fixedByPeriod.set(key, (fixedByPeriod.get(key) ?? 0) + safeExpense)
    } else {
      // "Variable" = toutes les dépenses hors socle fixe.
      variableByPeriod.set(key, (variableByPeriod.get(key) ?? 0) + safeExpense)
    }
  }

  assertNoNonExpenseBucketsInExpenseTotal(includedBucketsInExpenseTotal, 'getComparedYtdFlows:expenseByPeriod')

  const savingsByPeriod = new Map<string, number>()
  for (const row of (savingsRes.data ?? []) as RawSavingsRow[]) {
    const parsed = extractYearMonth(row.transaction_date)
    if (!parsed) continue
    if (!allowedYears.has(parsed.year) || !allowedMonths.has(parsed.month)) continue

    // "Épargne versée" : on consolide en valeur absolue pour neutraliser le signe comptable.
    const amount = Math.abs(Number(row.amount ?? 0))
    if (!Number.isFinite(amount) || amount === 0) continue

    const key = buildPeriodKey(parsed.year, parsed.month)
    savingsByPeriod.set(key, (savingsByPeriod.get(key) ?? 0) + amount)
  }

  const rows: YtdFlowRow[] = []
  for (const year of COMPARED_YEARS) {
    for (const month of COMPARED_MONTHS) {
      const key = buildPeriodKey(year, month)
      rows.push({
        period_year: year,
        period_month: month,
        expense_total: expenseByPeriod.get(key) ?? 0,
        income_total: incomeByPeriod.get(key) ?? 0,
        fixed_expense_total: fixedByPeriod.get(key) ?? 0,
        variable_expense_total: variableByPeriod.get(key) ?? 0,
        savings_realized_total: savingsByPeriod.get(key) ?? 0,
      })
    }
  }

  return rows
}
