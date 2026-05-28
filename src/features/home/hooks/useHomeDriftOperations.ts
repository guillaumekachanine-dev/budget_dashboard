import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@/hooks/useAuth'
import { QK, STALE } from '@/lib/queryKeys'
import { budgetDb } from '@/lib/supabaseBudget'
import { getCurrentPeriod } from '@/lib/utils'

export type HomeDriftOperation = {
  id: string
  categoryId: string | null
  categoryName: string | null
  categoryIconKey: string | null
  operationDate: string
  label: string
  budgetAccountingAmount: number
  operationKind: string
  isMatched: boolean
}

function toLocalIsoDate(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function resolveCutoffDate(year: number, month: number, now: Date): string {
  const currentYear = now.getFullYear()
  const currentMonth = now.getMonth() + 1

  if (year < currentYear || (year === currentYear && month < currentMonth)) {
    return toLocalIsoDate(new Date(year, month, 0))
  }

  return toLocalIsoDate(now)
}

function isAccountingActiveOperation(row: { operation_kind: string | null; is_matched: boolean | null }): boolean {
  if (row.operation_kind === 'actual') return row.is_matched === false
  if (row.operation_kind === 'planned_occurrence') return row.is_matched === true
  return false
}

export function useHomeDriftOperations(periodYear?: number, periodMonth?: number) {
  const { user } = useAuth()
  const userId = user?.id ?? null
  const { year: defaultYear, month: defaultMonth } = getCurrentPeriod()
  const targetYear = periodYear ?? defaultYear
  const targetMonth = periodMonth ?? defaultMonth

  const now = new Date()
  const monthStart = toLocalIsoDate(new Date(targetYear, targetMonth - 1, 1))
  const cutoffDate = resolveCutoffDate(targetYear, targetMonth, now)

  return useQuery<HomeDriftOperation[]>({
    queryKey: [QK.HOME, 'drift-operations', userId, targetYear, targetMonth, monthStart, cutoffDate],
    enabled: Boolean(userId),
    staleTime: STALE.LIVE,
    queryFn: async () => {
      if (cutoffDate < monthStart) return []

      const { data, error } = await budgetDb
        .from('v_flux_operations_unified')
        .select(
          'id,category_id,category_name,category_icon_key,operation_date,label,budget_accounting_amount,operation_kind,is_matched,budget_behavior,flow_type',
        )
        .eq('user_id', userId as string)
        .gte('operation_date', monthStart)
        .lte('operation_date', cutoffDate)
        .eq('flow_type', 'expense')
        .lt('budget_accounting_amount', 0)

      if (error) throw error

      const normalized: HomeDriftOperation[] = []
      for (const raw of data ?? []) {
        const row = raw as Record<string, unknown>
        const operationKind = String(row.operation_kind ?? '')
        const isMatched = row.is_matched === true
        const budgetBehavior = String(row.budget_behavior ?? '')
        const amount = Number(row.budget_accounting_amount ?? 0)

        if (!isAccountingActiveOperation({ operation_kind: operationKind, is_matched: isMatched })) continue
        if (!Number.isFinite(amount) || amount === 0) continue
        if (budgetBehavior === 'excluded') continue

        normalized.push({
          id: String(row.id ?? ''),
          categoryId: row.category_id ? String(row.category_id) : null,
          categoryName: row.category_name ? String(row.category_name) : null,
          categoryIconKey: row.category_icon_key ? String(row.category_icon_key) : null,
          operationDate: String(row.operation_date ?? ''),
          label: row.label ? String(row.label) : '',
          budgetAccountingAmount: amount,
          operationKind,
          isMatched,
        })
      }

      return normalized
    },
  })
}
