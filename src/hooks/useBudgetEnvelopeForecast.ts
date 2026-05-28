import { useQuery } from '@tanstack/react-query'
import { budgetDb } from '@/lib/supabaseBudget'
import { todayIso } from '@/lib/utils'

type ForecastSummary = {
  realizedAmount: number
  futureFixedAmount: number
  realizedPlusFutureFixedAmount: number
}

type ForecastByKey = Record<string, ForecastSummary>

type BudgetEnvelopeForecastData = {
  byCategoryId: ForecastByKey
  byBucket: ForecastByKey
  total: ForecastSummary
}

type UseBudgetEnvelopeForecastParams = {
  userId?: string
  startDate?: string
  endDate?: string
}

type UnifiedOperationRow = {
  operation_kind: string | null
  is_matched: boolean | null
  operation_date: string | null
  budget_behavior: string | null
  budget_accounting_amount: number | string | null
  flow_type: string | null
  category_id: string | null
  budget_bucket: string | null
}

function createEmptySummary(): ForecastSummary {
  return {
    realizedAmount: 0,
    futureFixedAmount: 0,
    realizedPlusFutureFixedAmount: 0,
  }
}

function toSignedAmount(value: number | string | null): number {
  const amount = Number(value ?? 0)
  return Number.isFinite(amount) ? amount : 0
}

function getOrInit(map: ForecastByKey, key: string): ForecastSummary {
  if (!map[key]) map[key] = createEmptySummary()
  return map[key]
}

function finalizeSummary(summary: ForecastSummary): ForecastSummary {
  const realizedAmount = Math.abs(summary.realizedAmount)
  const futureFixedAmount = Math.abs(summary.futureFixedAmount)
  return {
    realizedAmount,
    futureFixedAmount,
    realizedPlusFutureFixedAmount: realizedAmount + futureFixedAmount,
  }
}

function buildForecast(rows: UnifiedOperationRow[]): BudgetEnvelopeForecastData {
  const byCategoryId: ForecastByKey = {}
  const byBucket: ForecastByKey = {}
  const total = createEmptySummary()
  const today = todayIso()

  for (const row of rows) {
    if (row.flow_type !== 'expense') continue
    const operationDate = row.operation_date?.slice(0, 10)
    if (!operationDate) continue

    const isPastOrToday = operationDate <= today
    const isFuture = operationDate > today
    const operationKind = row.operation_kind ?? ''
    const isMatched = row.is_matched === true
    const signedAmount = toSignedAmount(row.budget_accounting_amount)

    const isRealized =
      (operationKind === 'actual' && !isMatched && isPastOrToday)
      || (operationKind === 'planned_occurrence' && isMatched && isPastOrToday)

    const isFutureFixedPlanned =
      operationKind === 'planned_occurrence'
      && !isMatched
      && isFuture
      && row.budget_behavior === 'fixed'
      && signedAmount < 0

    if (!isRealized && !isFutureFixedPlanned) continue

    const categoryId = row.category_id
    const bucket = row.budget_bucket
    const apply = (target: ForecastSummary) => {
      if (isRealized && signedAmount < 0) target.realizedAmount += signedAmount
      if (isFutureFixedPlanned) target.futureFixedAmount += signedAmount
    }

    apply(total)
    if (categoryId) apply(getOrInit(byCategoryId, categoryId))
    if (bucket) apply(getOrInit(byBucket, bucket))
  }

  for (const key of Object.keys(byCategoryId)) {
    byCategoryId[key] = finalizeSummary(byCategoryId[key])
  }
  for (const key of Object.keys(byBucket)) {
    byBucket[key] = finalizeSummary(byBucket[key])
  }

  return {
    byCategoryId,
    byBucket,
    total: finalizeSummary(total),
  }
}

async function fetchBudgetEnvelopeForecast({
  userId,
  startDate,
  endDate,
}: UseBudgetEnvelopeForecastParams): Promise<BudgetEnvelopeForecastData> {
  if (!userId || !startDate || !endDate) {
    return { byCategoryId: {}, byBucket: {}, total: createEmptySummary() }
  }

  let query = budgetDb
    .from('v_flux_operations_unified')
    .select('operation_kind,is_matched,operation_date,budget_behavior,budget_accounting_amount,flow_type,category_id,budget_bucket')
    .eq('user_id', userId)
    .eq('flow_type', 'expense')
    .gte('operation_date', startDate)
    .lte('operation_date', endDate)

  const { data, error } = await query
  if (error) throw error

  return buildForecast((data ?? []) as UnifiedOperationRow[])
}

export type { ForecastSummary, BudgetEnvelopeForecastData }

export function useBudgetEnvelopeForecast(params: UseBudgetEnvelopeForecastParams) {
  const { userId, startDate, endDate } = params
  return useQuery({
    queryKey: ['budget-envelope-forecast', userId ?? '', startDate ?? '', endDate ?? ''],
    enabled: Boolean(userId && startDate && endDate),
    staleTime: 60_000,
    queryFn: () => fetchBudgetEnvelopeForecast({ userId, startDate, endDate }),
  })
}
