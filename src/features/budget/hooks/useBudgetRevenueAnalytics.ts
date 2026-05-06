import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { budgetDb } from '@/lib/supabaseBudget'
import type {
  BudgetRevenueAnalytics,
  BudgetRevenueMonthlyPoint,
  BudgetRevenueSource,
  BudgetRevenueTransaction,
} from '@/features/budget/types'

const REVENUE_ANALYTICS_START_DATE = '2025-01-01'

interface UseBudgetRevenueAnalyticsResult {
  loading: boolean
  error: Error | null
  data: BudgetRevenueAnalytics | null
}

interface MonthlyRevenueRow {
  month_start: string | null
  budget_bucket: string | null
  transaction_count: number | null
  revenue_amount: number | null
  net_amount: number | null
}

interface RevenueTransactionRow {
  id: string | null
  transaction_date: string | null
  amount: number | null
  pilotage_amount: number | null
  normalized_label: string | null
  raw_label: string | null
  mapped_category_name: string | null
  mapped_parent_category_name: string | null
  mapped_budget_bucket: string | null
  account_id: string | null
}

interface SourceAggregate {
  source_name: string
  parent_source_name: string | null
  total_amount: number
  transaction_count: number
  last_transaction_date: string | null
}

function asMonthStart(value: string | null | undefined): string | null {
  if (!value) return null
  const normalized = value.slice(0, 10)
  return /^\d{4}-\d{2}-\d{2}$/.test(normalized) ? normalized : null
}

function asTransactionDate(value: string | null | undefined): string | null {
  if (!value) return null
  const normalized = value.slice(0, 10)
  return /^\d{4}-\d{2}-\d{2}$/.test(normalized) ? normalized : null
}

function monthStartFromPeriod(periodYear?: number, periodMonth?: number): string | null {
  if (!periodYear || !periodMonth) return null
  if (!Number.isFinite(periodYear) || !Number.isFinite(periodMonth)) return null
  if (periodMonth < 1 || periodMonth > 12) return null
  return `${periodYear}-${String(periodMonth).padStart(2, '0')}-01`
}

function average(values: number[]): number {
  if (!values.length) return 0
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

function toRevenueTransaction(row: RevenueTransactionRow, index: number): BudgetRevenueTransaction {
  const categoryName = row.mapped_category_name?.trim() || null
  const transactionDate = asTransactionDate(row.transaction_date) ?? ''
  return {
    id: row.id ?? `revenu-${index}`,
    transaction_date: transactionDate,
    label: row.normalized_label?.trim() || row.raw_label?.trim() || categoryName || 'Revenu',
    category_name: categoryName,
    parent_category_name: row.mapped_parent_category_name?.trim() || null,
    amount: Number(row.amount ?? 0),
    pilotage_amount: Number(row.pilotage_amount ?? 0),
  }
}

export function useBudgetRevenueAnalytics(periodYear?: number, periodMonth?: number): UseBudgetRevenueAnalyticsResult {
  const { user, loading: authLoading } = useAuth()
  const userId = user?.id ?? null

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const [data, setData] = useState<BudgetRevenueAnalytics | null>(null)

  const mountedRef = useRef(true)
  const runIdRef = useRef(0)

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])

  const load = useCallback(async () => {
    if (!userId) {
      throw new Error('Utilisateur non connecté: revenus indisponibles.')
    }

    const runId = ++runIdRef.current
    setLoading(true)
    setError(null)

    try {
      const [monthlyResponse, transactionsResponse] = await Promise.all([
        budgetDb()
          .from('v_monthly_bucket_actuals_clean')
          .select('month_start,budget_bucket,transaction_count,revenue_amount,net_amount')
          .eq('user_id', userId)
          .eq('budget_bucket', 'revenu')
          .gte('month_start', REVENUE_ANALYTICS_START_DATE)
          .order('month_start', { ascending: true }),
        budgetDb()
          .from('v_budget_transactions_enriched')
          .select('id,transaction_date,amount,pilotage_amount,normalized_label,raw_label,mapped_category_name,mapped_parent_category_name,mapped_budget_bucket,account_id')
          .eq('user_id', userId)
          .eq('mapped_budget_bucket', 'revenu')
          .gt('pilotage_amount', 0)
          .gte('transaction_date', REVENUE_ANALYTICS_START_DATE)
          .order('transaction_date', { ascending: false }),
      ])

      if (monthlyResponse.error) {
        throw new Error(`useBudgetRevenueAnalytics failed (monthly): ${monthlyResponse.error.message}`)
      }

      if (transactionsResponse.error) {
        throw new Error(`useBudgetRevenueAnalytics failed (transactions): ${transactionsResponse.error.message}`)
      }

      if (!mountedRef.current || runId !== runIdRef.current) return

      const monthlyRows = (monthlyResponse.data ?? []) as MonthlyRevenueRow[]
      const transactionRows = (transactionsResponse.data ?? []) as RevenueTransactionRow[]

      const monthlySeries = monthlyRows
        .map((row): BudgetRevenueMonthlyPoint | null => {
          const monthStart = asMonthStart(row.month_start)
          if (!monthStart) return null
          return {
            month_start: monthStart,
            revenue_amount: Number(row.revenue_amount ?? 0),
            transaction_count: Number(row.transaction_count ?? 0),
          }
        })
        .filter((row): row is BudgetRevenueMonthlyPoint => row != null)
        .sort((a, b) => a.month_start.localeCompare(b.month_start))

      const selectedMonthStart = monthStartFromPeriod(periodYear, periodMonth)
      const selectedMonthPoint = selectedMonthStart
        ? monthlySeries.find((row) => row.month_start === selectedMonthStart)
        : null

      const monthlyAmounts = monthlySeries.map((row) => Number(row.revenue_amount ?? 0))
      const lastSixMonthlyAmounts = monthlySeries.slice(-6).map((row) => Number(row.revenue_amount ?? 0))

      const sourceMap = transactionRows.reduce<Map<string, SourceAggregate>>((acc, row) => {
        const pilotageAmount = Number(row.pilotage_amount ?? 0)
        if (!(pilotageAmount > 0)) return acc

        const sourceName = row.mapped_category_name?.trim() || 'Revenus non catégorisés'
        const transactionDate = asTransactionDate(row.transaction_date)
        const existing = acc.get(sourceName)

        if (!existing) {
          acc.set(sourceName, {
            source_name: sourceName,
            parent_source_name: row.mapped_parent_category_name?.trim() || null,
            total_amount: pilotageAmount,
            transaction_count: 1,
            last_transaction_date: transactionDate,
          })
          return acc
        }

        existing.total_amount += pilotageAmount
        existing.transaction_count += 1
        if (!existing.parent_source_name && row.mapped_parent_category_name?.trim()) {
          existing.parent_source_name = row.mapped_parent_category_name.trim()
        }
        if (transactionDate && (!existing.last_transaction_date || transactionDate > existing.last_transaction_date)) {
          existing.last_transaction_date = transactionDate
        }
        return acc
      }, new Map<string, SourceAggregate>())

      const bySource: BudgetRevenueSource[] = [...sourceMap.values()]
        .map((entry) => ({
          source_name: entry.source_name,
          parent_source_name: entry.parent_source_name,
          total_amount: entry.total_amount,
          transaction_count: entry.transaction_count,
          avg_amount: entry.transaction_count > 0 ? entry.total_amount / entry.transaction_count : 0,
          last_transaction_date: entry.last_transaction_date,
        }))
        .sort((a, b) => b.total_amount - a.total_amount)

      const lastTransactions = transactionRows
        .map(toRevenueTransaction)
        .slice(0, 10)

      const nextData: BudgetRevenueAnalytics = {
        selectedMonthRevenue: Number(selectedMonthPoint?.revenue_amount ?? 0),
        selectedMonthTransactionCount: Number(selectedMonthPoint?.transaction_count ?? 0),
        avgMonthlyRevenue2025_2026: average(monthlyAmounts),
        avgMonthlyRevenueLast6M: average(lastSixMonthlyAmounts),
        maxMonthlyRevenue: monthlyAmounts.length ? Math.max(...monthlyAmounts) : 0,
        minMonthlyRevenue: monthlyAmounts.length ? Math.min(...monthlyAmounts) : 0,
        monthlySeries,
        bySource,
        lastTransactions,
      }

      setData(nextData)
      setLoading(false)
    } catch (loadError) {
      if (!mountedRef.current || runId !== runIdRef.current) return

      setData(null)
      setError(loadError instanceof Error ? loadError : new Error('Chargement des revenus impossible.'))
      setLoading(false)
    }
  }, [periodMonth, periodYear, userId])

  useEffect(() => {
    if (authLoading) {
      setLoading(true)
      return
    }

    if (!userId) {
      setLoading(false)
      setData(null)
      setError(new Error('Utilisateur non connecté: revenus indisponibles.'))
      return
    }

    void load()
  }, [authLoading, load, userId])

  return useMemo(
    () => ({
      loading,
      error,
      data,
    }),
    [data, error, loading],
  )
}
