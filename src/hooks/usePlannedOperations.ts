import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { budgetDb } from '@/lib/supabaseBudget'
import type {
  PlannedOperation,
  PlannedOperationFlowItem,
  PlannedOperationFlowType,
  PlannedOperationInsert,
  PlannedOperationsEnrichedViewRow,
} from '@/lib/types'

export function usePlannedOperations(userId?: string) {
  return useQuery({
    queryKey: ['planned-operations', userId],
    enabled: Boolean(userId),
    queryFn: async (): Promise<PlannedOperation[]> => {
      const { data, error } = await budgetDb
        .from('planned_operations')
        .select('*, category:categories(id,name,icon_key)')
        .eq('user_id', userId as string)
        .eq('status', 'planned')
        .order('planned_date', { ascending: true })
        .order('created_at', { ascending: false })

      if (error) throw error
      return data ?? []
    },
  })
}

export type GetPlannedOperationsForFlowParams = {
  userId: string
  startDate: string
  endDate: string
  includePast: boolean
  includeFuture: boolean
  flowType?: PlannedOperationFlowType | 'all'
  categoryIds?: string[]
  ascending?: boolean
}

export function getTodayDateKey(): string {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function toLocalDateKey(value?: string | null): string {
  if (!value) return ''
  return value.slice(0, 10)
}

export async function getPlannedOperationsForFlow({
  userId,
  startDate,
  endDate,
  includePast,
  includeFuture,
  flowType = 'all',
  categoryIds,
  ascending = false,
}: GetPlannedOperationsForFlowParams): Promise<PlannedOperationFlowItem[]> {
  if (!includePast && !includeFuture) return []

  let query = budgetDb
    .from('v_planned_operations_occurrences_enriched')
    .select(
      `
      id,
      source_planned_operation_id,
      account_id,
      category_id,
      label,
      original_planned_date,
      original_month_start,
      planned_date,
      month_start,
      planned_amount,
      personal_share_ratio,
      planned_personal_amount,
      currency,
      flow_type,
      status,
      budget_impact,
      category_name,
      parent_category_name,
      budget_bucket,
      impacts_remaining_useful,
      remaining_useful_impact_amount,
      matched_transaction_id,
      notes,
      planned_status,
      is_generated_occurrence,
      created_at,
      updated_at
    `,
    )
    .eq('user_id', userId)
    .gte('planned_date', startDate)
    .lte('planned_date', endDate)
    .order('planned_date', { ascending })

  if (flowType !== 'all') query = query.eq('flow_type', flowType)
  if (categoryIds && categoryIds.length > 0) query = query.in('category_id', categoryIds)
  if (includePast && !includeFuture) query = query.eq('planned_status', 'done')
  if (!includePast && includeFuture) query = query.eq('planned_status', 'upcoming')

  const { data, error } = await query
  if (error) throw error

  const todayKey = getTodayDateKey()
  const rows = (data ?? []) as PlannedOperationsEnrichedViewRow[]

  const mapped = rows
    .filter((row) => Boolean(row.id && row.planned_date))
    .map<PlannedOperationFlowItem>((row) => {
      const plannedDateKey = toLocalDateKey(row.planned_date)
      const plannedStatus: PlannedOperationFlowItem['planned_status'] =
        row.planned_status === 'done' || row.planned_status === 'upcoming'
          ? row.planned_status
          : (plannedDateKey <= todayKey ? 'done' : 'upcoming')

      return {
        id: row.id as string,
        source_planned_operation_id: row.source_planned_operation_id ?? (row.id as string),
        account_id: row.account_id,
        category_id: row.category_id,
        label: row.label,
        original_planned_date: row.original_planned_date,
        original_month_start: row.original_month_start,
        planned_date: plannedDateKey,
        month_start: row.month_start ?? plannedDateKey.slice(0, 7) + '-01',
        planned_amount: Number(row.planned_amount ?? 0),
        personal_share_ratio: row.personal_share_ratio,
        planned_personal_amount: Number(row.planned_personal_amount ?? row.planned_amount ?? 0),
        currency: row.currency,
        flow_type: row.flow_type ?? null,
        status: row.status,
        budget_impact: row.budget_impact,
        category_name: row.category_name,
        parent_category_name: row.parent_category_name,
        budget_bucket: row.budget_bucket,
        impacts_remaining_useful: row.impacts_remaining_useful,
        remaining_useful_impact_amount: row.remaining_useful_impact_amount,
        matched_transaction_id: row.matched_transaction_id,
        notes: row.notes,
        is_generated_occurrence: Boolean(row.is_generated_occurrence),
        created_at: row.created_at,
        updated_at: row.updated_at,
        source: 'planned_operation',
        planned_status: plannedStatus,
      }
    })

  if (includePast && includeFuture) return mapped
  if (includePast) return mapped.filter((row) => row.planned_status === 'done')
  return mapped.filter((row) => row.planned_status === 'upcoming')
}

type UsePlannedOperationsForFlowParams = {
  userId?: string
  startDate?: string
  endDate?: string
  includePast: boolean
  includeFuture: boolean
  flowType?: PlannedOperationFlowType | 'all'
  categoryIds?: string[]
  enabled?: boolean
  mode: 'general' | 'planned'
  ascending?: boolean
}

export function usePlannedOperationsForFlow({
  userId,
  startDate,
  endDate,
  includePast,
  includeFuture,
  flowType = 'all',
  categoryIds,
  enabled = true,
  mode,
  ascending = false,
}: UsePlannedOperationsForFlowParams) {
  return useQuery({
    queryKey: [
      'planned-operations-flow',
      {
        userId,
        startDate,
        endDate,
        includePast,
        includeFuture,
        flowType,
        categoryIds: categoryIds?.slice().sort().join(',') ?? '',
        mode,
        ascending,
      },
    ],
    enabled: Boolean(enabled && userId && startDate && endDate),
    queryFn: () =>
      getPlannedOperationsForFlow({
        userId: userId as string,
        startDate: startDate as string,
        endDate: endDate as string,
        includePast,
        includeFuture,
        flowType,
        categoryIds,
        ascending,
      }),
    staleTime: mode === 'general' ? 60_000 : 2 * 60_000,
  })
}

export function useAddPlannedOperation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (plannedOperation: PlannedOperationInsert) => {
      const { data, error } = await budgetDb
        .from('planned_operations')
        .insert(plannedOperation)
        .select()
        .single()

      if (error) throw error
      return data
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['planned-operations'] })
    },
  })
}
