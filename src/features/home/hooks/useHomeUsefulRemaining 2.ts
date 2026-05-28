import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@/hooks/useAuth'
import { budgetDb } from '@/lib/supabaseBudget'
import { QK } from '@/lib/queryKeys'

type HomeUsefulRemainingParams = {
  year: number
  month: number
  fixedBudgetAmount: number
  provisionBudgetAmount: number
  savingsBudgetAmount: number
  daysRemaining: number
}

type HomeUsefulRemainingData = {
  revenueRealizedAmount: number
  variableEssentialActualAmount: number
  discretionaryActualAmount: number
  futureFixedAmount: number
  usefulRemainingAmount: number
  budgetPerDayAmount: number
}

function toLocalIsoDate(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function isRealizedToDate(operation: {
  operation_kind: string | null
  is_matched: boolean | null
  operation_date: string | null
}, todayIso: string): boolean {
  if (!operation.operation_date || operation.operation_date > todayIso) return false
  if (operation.operation_kind === 'actual') return operation.is_matched === false
  if (operation.operation_kind === 'planned_occurrence') return operation.is_matched === true
  return false
}

export function useHomeUsefulRemaining({
  year,
  month,
  fixedBudgetAmount,
  provisionBudgetAmount,
  savingsBudgetAmount,
  daysRemaining,
}: HomeUsefulRemainingParams) {
  const { user } = useAuth()
  const userId = user?.id ?? null

  const monthStart = toLocalIsoDate(new Date(year, month - 1, 1))
  const monthEnd = toLocalIsoDate(new Date(year, month, 0))
  const todayIso = toLocalIsoDate(new Date())

  return useQuery<HomeUsefulRemainingData>({
    queryKey: [
      QK.HOME,
      'useful-remaining',
      userId,
      monthStart,
      monthEnd,
      todayIso,
      fixedBudgetAmount,
      provisionBudgetAmount,
      savingsBudgetAmount,
      daysRemaining,
    ],
    enabled: Boolean(userId),
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await budgetDb
        .from('v_flux_operations_unified')
        .select('operation_kind,is_matched,operation_date,budget_behavior,flow_type,budget_bucket,budget_accounting_amount')
        .eq('user_id', userId!)
        .gte('operation_date', monthStart)
        .lte('operation_date', monthEnd)
        .in('flow_type', ['income', 'expense'])

      if (error) throw error

      let revenueRealizedAmount = 0
      let variableEssentialActualAmount = 0
      let discretionaryActualAmount = 0
      let futureFixedAmount = 0

      for (const row of data ?? []) {
        const operation = row as Record<string, unknown>
        const amount = Number(operation.budget_accounting_amount ?? 0)
        const operationDate = String(operation.operation_date ?? '')
        const flowType = String(operation.flow_type ?? '')
        const budgetBucket = String(operation.budget_bucket ?? '')
        const operationKind = String(operation.operation_kind ?? '')
        const isMatched = operation.is_matched === true
        const budgetBehavior = String(operation.budget_behavior ?? '')

        if (
          isRealizedToDate(
            {
              operation_kind: operationKind,
              is_matched: isMatched,
              operation_date: operationDate,
            },
            todayIso,
          )
        ) {
          if (flowType === 'income') {
            revenueRealizedAmount += amount
          } else if (flowType === 'expense') {
            if (budgetBucket === 'variable_essentielle') {
              variableEssentialActualAmount += Math.abs(amount)
            } else if (budgetBucket === 'discretionnaire') {
              discretionaryActualAmount += Math.abs(amount)
            }
          }
        }

        if (
          operationKind === 'planned_occurrence'
          && isMatched === false
          && operationDate > todayIso
          && operationDate <= monthEnd
          && budgetBehavior === 'fixed'
          && flowType === 'expense'
          && amount < 0
        ) {
          futureFixedAmount += Math.abs(amount)
        }
      }

      const usefulRemainingAmount =
        revenueRealizedAmount
        - fixedBudgetAmount
        - provisionBudgetAmount
        - savingsBudgetAmount
        - variableEssentialActualAmount
        - discretionaryActualAmount
        - futureFixedAmount

      const budgetPerDayAmount = daysRemaining > 0 ? usefulRemainingAmount / daysRemaining : usefulRemainingAmount

      return {
        revenueRealizedAmount,
        variableEssentialActualAmount,
        discretionaryActualAmount,
        futureFixedAmount,
        usefulRemainingAmount,
        budgetPerDayAmount,
      }
    },
  })
}
