import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { budgetDb } from '@/lib/supabaseBudget'
import { QK, STALE } from '@/lib/queryKeys'

export type SavingsActualByMonth = {
  period_year: number
  period_month: number
  month_start: string
  actual_savings_amount_eur: number
}

export type SavingsActualByMonthMap = Record<number, SavingsActualByMonth>

function toNumber(value: unknown): number {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

export function useSavingsActualsByMonth(userId?: string, year = 2026) {
  const query = useQuery({
    queryKey: [QK.SAVINGS, 'actuals-by-month', year, userId],
    enabled: Boolean(userId),
    staleTime: STALE.LIVE,
    queryFn: async (): Promise<SavingsActualByMonth[]> => {
      const startDate = `${year}-01-01`
      const endDate = `${year}-12-31`

      const { data, error } = await budgetDb
        .from('transactions')
        .select('transaction_date, amount, personal_share_ratio')
        .eq('user_id', userId as string)
        .eq('flow_type', 'savings')
        .eq('is_hidden', false)
        .gte('transaction_date', startDate)
        .lte('transaction_date', endDate)

      if (error) throw error

      const grouped = new Map<string, number>()
      for (const row of data ?? []) {
        const transactionDate = String(row.transaction_date ?? '')
        const [yearRaw, monthRaw] = transactionDate.split('-')
        const periodYear = Number(yearRaw)
        const periodMonth = Number(monthRaw)
        if (!Number.isFinite(periodYear) || !Number.isFinite(periodMonth) || periodMonth < 1 || periodMonth > 12) continue

        const personalShareRatio = row.personal_share_ratio == null ? 1 : toNumber(row.personal_share_ratio)
        const actualAmount = toNumber(row.amount) * personalShareRatio
        const monthKey = `${periodYear}-${String(periodMonth).padStart(2, '0')}`
        grouped.set(monthKey, (grouped.get(monthKey) ?? 0) + actualAmount)
      }

      return [...grouped.entries()]
        .map(([monthKey, amount]) => {
          const [yearStr, monthStr] = monthKey.split('-')
          return {
            period_year: Number(yearStr),
            period_month: Number(monthStr),
            month_start: `${monthKey}-01`,
            actual_savings_amount_eur: amount,
          }
        })
        .sort((a, b) => (a.period_year - b.period_year) || (a.period_month - b.period_month))
    },
  })

  const byMonth = useMemo<SavingsActualByMonthMap>(() => {
    const map: SavingsActualByMonthMap = {}
    for (const row of query.data ?? []) {
      map[row.period_month] = row
    }
    return map
  }, [query.data])

  return {
    data: query.data ?? [],
    byMonth,
    isLoading: query.isLoading,
    error: query.error ?? null,
  }
}
