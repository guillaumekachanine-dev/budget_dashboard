import { useQuery } from '@tanstack/react-query'
import { budgetDb } from '@/lib/supabaseBudget'
import type { BudgetBehavior, FlowType, PlannedOperationBudgetImpact, PlannedOperationRecurrenceFrequency, PlannedOperationStatus } from '@/lib/types'

export type FluxOperationKind = 'actual' | 'planned_occurrence'
export type FluxOperationMatchType = 'explicit' | 'inferred' | null

export interface FluxOperation {
  id: string
  operation_kind: FluxOperationKind
  source_planned_operation_id: string | null
  source_transaction_id: string | null
  user_id: string
  account_id: string | null
  account_name: string | null
  category_id: string | null
  category_name: string | null
  parent_category_name: string | null
  category_icon_key: string | null
  budget_behavior: BudgetBehavior | null
  budget_bucket: string | null
  operation_date: string
  label: string
  merchant_name: string | null
  amount: number
  currency: string
  direction: string | null
  flow_type: FlowType
  personal_share_ratio: number | null
  personal_amount: number | null
  is_recurring: boolean
  recurrence_frequency: PlannedOperationRecurrenceFrequency | null
  recurrence_day_of_month: number | null
  recurrence_start_date: string | null
  recurrence_end_date: string | null
  budget_impact: PlannedOperationBudgetImpact | null
  planned_status: PlannedOperationStatus | null
  matched_transaction_id: string | null
  matched_planned_operation_id: string | null
  is_matched: boolean
  match_type: FluxOperationMatchType
  is_hidden: boolean
  is_planned_occurrence: boolean
  is_actual_transaction: boolean
  notes: string | null
  created_at: string
  updated_at: string
  budget_accounting_amount: number
  banking_amount: number
  display_amount: number
}

export interface FluxOperationFilters {
  userId?: string
  accountKind?: 'all' | 'joint' | 'perso'
  budgetFilter?: 'all' | 'fixed' | 'variable'
  categoryIds?: string[]
  flowType?: FlowType
  startDate?: string
  endDate?: string
  search?: string
  includeHiddenActuals?: boolean
  includeShadowedActuals?: boolean
}

function buildQueryKey(filters: FluxOperationFilters) {
  return ['flux-operations', filters] as const
}

const PAGE_SIZE = 1000
const MAX_ROWS = 5000

async function fetchFluxOperations(filters: FluxOperationFilters): Promise<FluxOperation[]> {
  if (!filters.userId) return []

  let query = budgetDb()
    .from('v_flux_operations_unified')
    .select('*')
    .eq('user_id', filters.userId)

  if (!filters.includeHiddenActuals) query = query.eq('is_hidden', false)
  if (!filters.includeShadowedActuals) query = query.or('operation_kind.eq.planned_occurrence,budget_accounting_amount.neq.0')
  if (filters.flowType) query = query.eq('flow_type', filters.flowType)
  if (filters.startDate) query = query.gte('operation_date', filters.startDate)
  if (filters.endDate) query = query.lte('operation_date', filters.endDate)
  if (filters.categoryIds?.length) query = query.in('category_id', filters.categoryIds)
  if (filters.budgetFilter === 'fixed') query = query.eq('budget_behavior', 'fixed')
  if (filters.budgetFilter === 'variable') query = query.or('budget_behavior.eq.variable,budget_behavior.is.null')
  if (filters.accountKind === 'joint') query = query.ilike('account_name', '%joint%')
  if (filters.accountKind === 'perso') query = query.not('account_name', 'ilike', '%joint%')
  if (filters.search?.trim()) query = query.ilike('label', '%' + filters.search.trim() + '%')

  const rows: FluxOperation[] = []
  let from = 0

  while (true) {
    const { data, error } = await query
      .order('operation_date', { ascending: false })
      .order('operation_kind', { ascending: false })
      .range(from, from + PAGE_SIZE - 1)

    if (error) throw error

    const page = (data ?? []) as FluxOperation[]
    rows.push(...page)

    if (rows.length >= MAX_ROWS || page.length < PAGE_SIZE) break
    from += PAGE_SIZE
  }

  return rows
}

export function useFluxOperations(filters: FluxOperationFilters) {
  return useQuery({
    queryKey: buildQueryKey(filters),
    queryFn: () => fetchFluxOperations(filters),
    enabled: Boolean(filters.userId),
    staleTime: 2 * 60_000,
  })
}
