import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@/hooks/useAuth'
import { budgetDb } from '@/lib/supabaseBudget'
import { STALE } from '@/lib/queryKeys'

type OperationKind = 'actual' | 'planned_occurrence' | string
type FlowType = 'income' | 'expense' | 'savings' | string

type FluxRow = {
  id: string | null
  operation_date: string | null
  operation_kind: OperationKind | null
  is_matched: boolean | null
  flow_type: FlowType | null
  is_hidden: boolean | null
  label: string | null
  category_name: string | null
  parent_category_name: string | null
  budget_accounting_amount: number | string | null
}

export type MonthlyTrajectoryRow = {
  day_of_month: number
  forecast_date: string
  daily_income: number
  daily_expenses: number
  daily_savings: number
  daily_cashflow: number
  cumulative_expenses: number
  cumulative_cashflow: number
}

export type MonthlyTrajectorySeriesPoint = {
  day_of_month: number
  forecast_date: string
  value: number
}

export type MonthlyTrajectoryData = {
  tableRows: MonthlyTrajectoryRow[]
  expensesSeries: MonthlyTrajectorySeriesPoint[]
  cashflowSeries: MonthlyTrajectorySeriesPoint[]
  operationsByDay: Record<number, TrajectoryOperation[]>
  operationsCountByDay: Record<number, number>
  savingsDays: number[]
  incomeDay: number
  monthlyProjectedIncomeAmount: number
}

export type UseMonthlyTrajectoryDataParams = {
  year: number
  month: number
  includeFuturePlanned?: boolean
  projectedMonthlyIncomeAmount?: number
  projectedIncomeDay?: number
  asOfDate?: string
  enabled?: boolean
}

export type TrajectoryOperation = {
  id: string
  operationDate: string
  operationKind: 'actual' | 'planned_occurrence'
  flowType: 'income' | 'expense' | 'savings' | string
  label: string
  categoryName: string | null
  parentCategoryName: string | null
  amount: number
  budgetAccountingAmount: number
  isMatched: boolean
  isProjected: boolean
}

function pad2(value: number): string {
  return String(value).padStart(2, '0')
}

function toIsoDateLocal(date: Date): string {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`
}

function toNumber(value: unknown): number {
  const n = Number(value)
  return Number.isFinite(n) ? n : 0
}

function buildMonthBounds(year: number, month: number) {
  const monthStart = `${year}-${pad2(month)}-01`
  const daysInMonth = new Date(year, month, 0).getDate()
  const monthEnd = `${year}-${pad2(month)}-${pad2(daysInMonth)}`
  return { monthStart, monthEnd, daysInMonth }
}

function minIsoDate(a: string, b: string): string {
  return a <= b ? a : b
}

export function useMonthlyTrajectoryData({
  year,
  month,
  includeFuturePlanned = true,
  projectedMonthlyIncomeAmount = 0,
  projectedIncomeDay = 4,
  asOfDate,
  enabled = true,
}: UseMonthlyTrajectoryDataParams) {
  const { user } = useAuth()
  const { monthStart, monthEnd, daysInMonth } = buildMonthBounds(year, month)
  const cutoffDate = minIsoDate(asOfDate ?? toIsoDateLocal(new Date()), monthEnd)

  return useQuery<MonthlyTrajectoryData>({
    queryKey: [
      'monthly-trajectory-data',
      year,
      month,
      includeFuturePlanned ? 1 : 0,
      Number(projectedMonthlyIncomeAmount.toFixed(2)),
      projectedIncomeDay,
      cutoffDate,
      user?.id ?? 'anon',
    ],
    enabled: Boolean(user?.id) && enabled,
    staleTime: STALE.ANALYTICS,
    queryFn: async () => {
      const [dailyForecastRes, operationsRes] = await Promise.all([
        budgetDb
          .from('daily_cashflow_forecast' as never)
          .select(
            `
            forecast_date,
            day_of_month,
            daily_income,
            daily_total_expenses,
            daily_savings_ops,
            cumulative_expenses,
            cumulative_cashflow,
            daily_income_projected,
            daily_expense_projected,
            daily_savings_projected,
            daily_cashflow_projected,
            cumulative_expense_projected,
            cumulative_cashflow_projected
          `,
          )
          .eq('user_id', user?.id as string)
          .eq('period_year', year)
          .eq('period_month', month)
          .order('day_of_month', { ascending: true }),
        budgetDb
        .from('v_flux_operations_unified' as never)
        .select('id,operation_date,operation_kind,is_matched,flow_type,is_hidden,label,category_name,parent_category_name,budget_accounting_amount')
        .eq('user_id', user?.id as string)
        .gte('operation_date', monthStart)
        .lte('operation_date', monthEnd)
        .in('flow_type', ['income', 'expense', 'savings'])
        .neq('budget_accounting_amount', 0)
          .order('operation_date', { ascending: true }),
      ])

      if (dailyForecastRes.error) throw dailyForecastRes.error
      if (operationsRes.error) throw operationsRes.error

      const dailyForecastRows = (dailyForecastRes.data ?? []) as Array<Record<string, unknown>>
      const operationsByDayMap = new Map<number, TrajectoryOperation[]>()
      for (const row of (operationsRes.data ?? []) as FluxRow[]) {
        const operationDate = String(row.operation_date ?? '').slice(0, 10)
        if (!operationDate) continue

        if (Boolean(row.is_hidden ?? false)) continue

        const signedAmount = toNumber(row.budget_accounting_amount)
        if (!signedAmount) continue

        const day = Number(operationDate.slice(8, 10))
        if (!Number.isFinite(day) || day < 1 || day > daysInMonth) continue

        const kind = row.operation_kind ?? ''
        const flowType = String(row.flow_type ?? '')
        const isMatched = Boolean(row.is_matched ?? false)

        const isRealized =
          operationDate <= cutoffDate &&
          ((kind === 'actual' && !isMatched) || (kind === 'planned_occurrence' && isMatched))

        const isFuturePlanned =
          includeFuturePlanned &&
          operationDate > cutoffDate &&
          kind === 'planned_occurrence' &&
          !isMatched &&
          (flowType === 'income' || flowType === 'expense')

        if (isRealized || isFuturePlanned) {
          const normalizedKind = kind === 'actual' ? 'actual' : 'planned_occurrence'
          const displayAmount = row.flow_type === 'income'
            ? Math.abs(signedAmount)
            : Math.abs(signedAmount)
          const dayOps = operationsByDayMap.get(day) ?? []
          dayOps.push({
            id: String(row.id ?? `${operationDate}-${dayOps.length}`),
            operationDate,
            operationKind: normalizedKind,
            flowType: String(row.flow_type ?? ''),
            label: String(row.label ?? 'Opération'),
            categoryName: row.category_name ?? null,
            parentCategoryName: row.parent_category_name ?? null,
            amount: Number(displayAmount.toFixed(2)),
            budgetAccountingAmount: Number(signedAmount.toFixed(2)),
            isMatched,
            isProjected: isFuturePlanned,
          })
          operationsByDayMap.set(day, dayOps)
        }
      }

      const hasCanonicalColumns = dailyForecastRows.length > 0 && Object.prototype.hasOwnProperty.call(dailyForecastRows[0], 'daily_income_projected')
      const tableRows: MonthlyTrajectoryRow[] = dailyForecastRows.map((row) => ({
        day_of_month: toNumber(row.day_of_month),
        forecast_date: String(row.forecast_date ?? ''),
        daily_income: hasCanonicalColumns ? toNumber(row.daily_income_projected) : toNumber(row.daily_income),
        daily_expenses: hasCanonicalColumns ? toNumber(row.daily_expense_projected) : toNumber(row.daily_total_expenses),
        daily_savings: hasCanonicalColumns ? toNumber(row.daily_savings_projected) : toNumber(row.daily_savings_ops),
        daily_cashflow: hasCanonicalColumns
          ? toNumber(row.daily_cashflow_projected)
          : Number(
            (
              toNumber(row.daily_income) -
              toNumber(row.daily_total_expenses) -
              toNumber(row.daily_savings_ops)
            ).toFixed(2),
          ),
        cumulative_expenses: hasCanonicalColumns ? toNumber(row.cumulative_expense_projected) : toNumber(row.cumulative_expenses),
        cumulative_cashflow: hasCanonicalColumns ? toNumber(row.cumulative_cashflow_projected) : toNumber(row.cumulative_cashflow),
      }))
      const canonicalMonthlyIncome = tableRows.reduce((sum, row) => sum + row.daily_income, 0)

      const normalizedIncomeDay = Math.min(Math.max(1, projectedIncomeDay), daysInMonth)
      const shouldInjectProjectedIncome =
        projectedMonthlyIncomeAmount > 0 &&
        Number(canonicalMonthlyIncome.toFixed(2)) <= 0

      if (shouldInjectProjectedIncome) {
        const daily = tableRows[normalizedIncomeDay - 1]
        if (daily) {
          daily.daily_income = Number((daily.daily_income + projectedMonthlyIncomeAmount).toFixed(2))
          daily.daily_cashflow = Number((daily.daily_cashflow + projectedMonthlyIncomeAmount).toFixed(2))
        }
        const incomeDayOps = operationsByDayMap.get(normalizedIncomeDay) ?? []
        incomeDayOps.push({
          id: `synthetic-income-${year}-${pad2(month)}-${pad2(normalizedIncomeDay)}`,
          operationDate: `${year}-${pad2(month)}-${pad2(normalizedIncomeDay)}`,
          operationKind: 'planned_occurrence',
          flowType: 'income',
          label: 'Revenu projeté (scénario #2)',
          categoryName: 'Revenus',
          parentCategoryName: 'Projection',
          amount: Number(projectedMonthlyIncomeAmount.toFixed(2)),
          budgetAccountingAmount: Number(projectedMonthlyIncomeAmount.toFixed(2)),
          isMatched: false,
          isProjected: true,
        })
        operationsByDayMap.set(normalizedIncomeDay, incomeDayOps)
        let rollingCashflow = 0
        for (const row of tableRows) {
          rollingCashflow += row.daily_cashflow
          row.cumulative_cashflow = Number(rollingCashflow.toFixed(2))
        }
      }

      const savingsDays: number[] = []
      const operationsCountByDay: Record<number, number> = {}
      const operationsByDay: Record<number, TrajectoryOperation[]> = {}

      for (let day = 1; day <= daysInMonth; day += 1) {
        const row = tableRows[day - 1] ?? {
          day_of_month: day,
          forecast_date: `${year}-${pad2(month)}-${pad2(day)}`,
          daily_income: 0,
          daily_expenses: 0,
          daily_savings: 0,
          daily_cashflow: 0,
          cumulative_expenses: 0,
          cumulative_cashflow: 0,
        }
        const dayOps = operationsByDayMap.get(day) ?? []
        const hasSavingsOp = dayOps.some((op) => op.flowType === 'savings')
        if ((row?.daily_savings ?? 0) > 0 && !hasSavingsOp) {
          dayOps.push({
            id: `synthetic-savings-${year}-${pad2(month)}-${pad2(day)}`,
            operationDate: `${year}-${pad2(month)}-${pad2(day)}`,
            operationKind: 'planned_occurrence',
            flowType: 'savings',
            label: 'Épargne projetée',
            categoryName: 'Épargne',
            parentCategoryName: 'Projection',
            amount: Number((row?.daily_savings ?? 0).toFixed(2)),
            budgetAccountingAmount: Number((-(row?.daily_savings ?? 0)).toFixed(2)),
            isMatched: false,
            isProjected: true,
          })
        }
        const ops = dayOps
        operationsByDay[day] = ops
        operationsCountByDay[day] = ops.length
        if ((row?.daily_savings ?? 0) > 0) savingsDays.push(day)
      }

      const expensesSeries: MonthlyTrajectorySeriesPoint[] = tableRows.map((row) => ({
        day_of_month: row.day_of_month,
        forecast_date: row.forecast_date,
        value: row.cumulative_expenses,
      }))

      const cashflowSeries: MonthlyTrajectorySeriesPoint[] = tableRows.map((row) => ({
        day_of_month: row.day_of_month,
        forecast_date: row.forecast_date,
        value: row.cumulative_cashflow,
      }))

      return {
        tableRows,
        expensesSeries,
        cashflowSeries,
        operationsByDay,
        operationsCountByDay,
        savingsDays,
        incomeDay: normalizedIncomeDay,
        monthlyProjectedIncomeAmount: shouldInjectProjectedIncome
          ? Number(projectedMonthlyIncomeAmount.toFixed(2))
          : 0,
      }
    },
  })
}
