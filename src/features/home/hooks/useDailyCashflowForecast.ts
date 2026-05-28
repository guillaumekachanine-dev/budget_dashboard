import { budgetDb } from '@/lib/supabaseBudget'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@/hooks/useAuth'
import { QK, STALE } from '@/lib/queryKeys'

export type DailyCashflowRow = {
  forecast_date: string
  day_of_month: number
  daily_income: number
  daily_fixed_ops: number
  daily_variable_ops: number
  daily_forward_ops: number
  daily_savings_ops: number
  daily_total_expenses: number
  cumulative_income: number
  cumulative_expenses: number
  cumulative_savings: number
  cumulative_cashflow: number
}

function asNumber(v: unknown): number {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

export function useDailyCashflowForecast(year: number, month: number) {
  const { user } = useAuth()

  return useQuery<DailyCashflowRow[]>({
    queryKey: [QK.DAILY_CASHFLOW_FORECAST, year, month],
    queryFn: async () => {
      const { data, error } = await budgetDb
        .from('daily_cashflow_forecast' as never)
        .select(
          'forecast_date, day_of_month, daily_income, daily_fixed_ops, daily_variable_ops, daily_forward_ops, daily_savings_ops, daily_total_expenses, cumulative_income, cumulative_expenses, cumulative_savings, cumulative_cashflow',
        )
        .eq('period_year', year)
        .eq('period_month', month)
        .order('day_of_month', { ascending: true })
      if (error) throw error
      return (data ?? []).map((row) => {
        const r = row as Record<string, unknown>
        return {
          forecast_date: String(r.forecast_date ?? ''),
          day_of_month: asNumber(r.day_of_month),
          daily_income: asNumber(r.daily_income),
          daily_fixed_ops: asNumber(r.daily_fixed_ops),
          daily_variable_ops: asNumber(r.daily_variable_ops),
          daily_forward_ops: asNumber(r.daily_forward_ops),
          daily_savings_ops: asNumber(r.daily_savings_ops),
          daily_total_expenses: asNumber(r.daily_total_expenses),
          cumulative_income: asNumber(r.cumulative_income),
          cumulative_expenses: asNumber(r.cumulative_expenses),
          cumulative_savings: asNumber(r.cumulative_savings),
          cumulative_cashflow: asNumber(r.cumulative_cashflow),
        }
      })
    },
    enabled: !!user,
    staleTime: STALE.ANALYTICS,
  })
}
