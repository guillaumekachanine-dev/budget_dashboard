import { budgetDb } from '@/lib/supabaseBudget'
import type { YtdFlowRow } from '@/features/annual-analysis/types.compared'
import { COMPARED_MONTHS, COMPARED_YEARS } from '@/features/annual-analysis/types.compared'

type RawFlowRow = {
  period_year: number | string | null
  period_month: number | string | null
  expense_total: number | string | null
  income_total: number | string | null
  fixed_expense_total: number | string | null
  variable_expense_total: number | string | null
}

type RawSavingsRow = {
  transaction_date: string | null
  amount: number | string | null
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

  const [metricsRes, savingsRes] = await Promise.all([
    budgetDb
      .from('v_monthly_metrics_clean' as never)
      .select('period_year, period_month, expense_total, income_total, fixed_expense_total, variable_expense_total')
      .in('period_year', [...COMPARED_YEARS])
      .in('period_month', [...COMPARED_MONTHS])
      .order('period_year', { ascending: true })
      .order('period_month', { ascending: true }),
    budgetDb
      .from('transactions')
      .select('transaction_date, amount')
      .eq('flow_type', 'savings')
      .eq('is_hidden', false)
      .gte('transaction_date', `${minYear}-01-01`)
      .lt('transaction_date', `${maxYear + 1}-01-01`)
      .order('transaction_date', { ascending: true }),
  ])

  if (metricsRes.error) throw new Error(`getComparedYtdFlows (metrics): ${metricsRes.error.message}`)
  if (savingsRes.error) throw new Error(`getComparedYtdFlows (savings): ${savingsRes.error.message}`)

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

  const rows = (metricsRes.data ?? []) as RawFlowRow[]
  return rows.map((row) => ({
    period_year:            Number(row.period_year ?? 0),
    period_month:           Number(row.period_month ?? 0),
    expense_total:          Number(row.expense_total ?? 0),
    income_total:           Number(row.income_total ?? 0),
    fixed_expense_total:    Number(row.fixed_expense_total ?? 0),
    variable_expense_total: Number(row.variable_expense_total ?? 0),
    savings_realized_total: savingsByPeriod.get(buildPeriodKey(Number(row.period_year ?? 0), Number(row.period_month ?? 0))) ?? 0,
  }))
}
