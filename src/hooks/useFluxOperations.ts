import { useQuery } from '@tanstack/react-query'
import { budgetDb } from '@/lib/supabaseBudget'
import type { FlowType } from '@/lib/types'

type OperationKind = 'actual' | 'planned_occurrence' | 'actual_shadowed' | 'actual_transaction'
type PlannedStatus = 'done' | 'upcoming' | null

type BudgetFilter = 'all' | 'already_budgeted' | 'additional_commitment' | 'informational'
type AccountKindFilter = 'all' | 'joint' | 'perso'

export interface FluxOperation {
  id: string
  operation_kind: OperationKind
  source_planned_operation_id: string | null
  source_transaction_id: string | null
  user_id: string
  account_id: string | null
  account_name: string | null
  category_id: string | null
  category_name: string | null
  parent_category_name: string | null
  category_icon_key: string | null
  budget_behavior: string | null
  budget_bucket: string | null
  operation_date: string
  label: string | null
  merchant_name: string | null
  amount: number | null
  currency: string | null
  direction: string | null
  flow_type: FlowType | null
  personal_share_ratio: number | null
  personal_amount: number | null
  is_recurring: boolean | null
  recurrence_frequency: string | null
  recurrence_day_of_month: number | null
  recurrence_start_date: string | null
  recurrence_end_date: string | null
  budget_impact: string | null
  planned_status: PlannedStatus
  matched_transaction_id: string | null
  matched_planned_operation_id: string | null
  is_matched: boolean | null
  match_type: string | null
  is_hidden: boolean | null
  is_planned_occurrence: boolean | null
  is_actual_transaction: boolean | null
  notes: string | null
  created_at: string | null
  updated_at: string | null
  budget_accounting_amount: number | null
  banking_amount: number | null
  display_amount: number | null
}

type UseFluxOperationsParams = {
  userId?: string
  startDate?: string
  endDate?: string
  flowType?: FlowType
  categoryIds?: string[]
  budgetFilter?: BudgetFilter
  accountKind?: AccountKindFilter
  search?: string
  includeShadowedActuals?: boolean
}

function toNumber(value: unknown): number | null {
  if (value == null) return null
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}

function mapOperation(row: Record<string, unknown>): FluxOperation {
  return {
    id: String(row.id),
    operation_kind: String(row.operation_kind) as OperationKind,
    source_planned_operation_id: (row.source_planned_operation_id as string | null) ?? null,
    source_transaction_id: (row.source_transaction_id as string | null) ?? null,
    user_id: String(row.user_id),
    account_id: (row.account_id as string | null) ?? null,
    account_name: (row.account_name as string | null) ?? null,
    category_id: (row.category_id as string | null) ?? null,
    category_name: (row.category_name as string | null) ?? null,
    parent_category_name: (row.parent_category_name as string | null) ?? null,
    category_icon_key: (row.category_icon_key as string | null) ?? null,
    budget_behavior: (row.budget_behavior as string | null) ?? null,
    budget_bucket: (row.budget_bucket as string | null) ?? null,
    operation_date: String(row.operation_date),
    label: (row.label as string | null) ?? null,
    merchant_name: (row.merchant_name as string | null) ?? null,
    amount: toNumber(row.amount),
    currency: (row.currency as string | null) ?? null,
    direction: (row.direction as string | null) ?? null,
    flow_type: (row.flow_type as FlowType | null) ?? null,
    personal_share_ratio: toNumber(row.personal_share_ratio),
    personal_amount: toNumber(row.personal_amount),
    is_recurring: (row.is_recurring as boolean | null) ?? null,
    recurrence_frequency: (row.recurrence_frequency as string | null) ?? null,
    recurrence_day_of_month: toNumber(row.recurrence_day_of_month),
    recurrence_start_date: (row.recurrence_start_date as string | null) ?? null,
    recurrence_end_date: (row.recurrence_end_date as string | null) ?? null,
    budget_impact: (row.budget_impact as string | null) ?? null,
    planned_status: (row.planned_status as PlannedStatus) ?? null,
    matched_transaction_id: (row.matched_transaction_id as string | null) ?? null,
    matched_planned_operation_id: (row.matched_planned_operation_id as string | null) ?? null,
    is_matched: (row.is_matched as boolean | null) ?? null,
    match_type: (row.match_type as string | null) ?? null,
    is_hidden: (row.is_hidden as boolean | null) ?? null,
    is_planned_occurrence: (row.is_planned_occurrence as boolean | null) ?? null,
    is_actual_transaction: (row.is_actual_transaction as boolean | null) ?? null,
    notes: (row.notes as string | null) ?? null,
    created_at: (row.created_at as string | null) ?? null,
    updated_at: (row.updated_at as string | null) ?? null,
    budget_accounting_amount: toNumber(row.budget_accounting_amount),
    banking_amount: toNumber(row.banking_amount),
    display_amount: toNumber(row.display_amount),
  }
}

async function fetchFluxOperations({
  userId,
  startDate,
  endDate,
  flowType,
  categoryIds,
  budgetFilter = 'all',
  accountKind = 'all',
  search,
  includeShadowedActuals = false,
}: UseFluxOperationsParams): Promise<FluxOperation[]> {
  if (!userId) return []

  let query = budgetDb
    .from('v_flux_operations_unified')
    .select('*')
    .eq('user_id', userId)
    .order('operation_date', { ascending: false })
    .order('created_at', { ascending: false })

  if (startDate) query = query.gte('operation_date', startDate)
  if (endDate) query = query.lte('operation_date', endDate)
  if (flowType) query = query.eq('flow_type', flowType)
  if (categoryIds && categoryIds.length > 0) query = query.in('category_id', categoryIds)
  if (budgetFilter !== 'all') query = query.eq('budget_impact', budgetFilter)

  if (!includeShadowedActuals) {
    query = query.or('operation_kind.eq.planned_occurrence,is_matched.eq.false')
  }

  if (accountKind === 'joint') query = query.ilike('account_name', '%joint%')
  if (accountKind === 'perso') query = query.not('account_name', 'ilike', '%joint%')

  const { data, error } = await query
  if (error) throw error

  let mapped = (data ?? []).map((row) => mapOperation(row as Record<string, unknown>))

  if (search?.trim()) {
    const q = search.trim().toLowerCase()
    mapped = mapped.filter((operation) => {
      const text = `${operation.label ?? ''} ${operation.merchant_name ?? ''} ${operation.category_name ?? ''}`.toLowerCase()
      return text.includes(q)
    })
  }

  return mapped
}

export function useFluxOperations(params: UseFluxOperationsParams) {
  const {
    userId,
    startDate,
    endDate,
    flowType,
    categoryIds,
    budgetFilter = 'all',
    accountKind = 'all',
    search,
    includeShadowedActuals = false,
  } = params

  return useQuery({
    queryKey: [
      'flux-operations',
      {
        userId,
        startDate,
        endDate,
        flowType,
        categoryIds: categoryIds?.slice().sort().join(',') ?? '',
        budgetFilter,
        accountKind,
        search: search?.trim() ?? '',
        includeShadowedActuals,
      },
    ],
    enabled: Boolean(userId),
    staleTime: 60_000,
    queryFn: () =>
      fetchFluxOperations({
        userId,
        startDate,
        endDate,
        flowType,
        categoryIds,
        budgetFilter,
        accountKind,
        search,
        includeShadowedActuals,
      }),
  })
}
