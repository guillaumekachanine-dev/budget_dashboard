import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { budgetDb } from '@/lib/supabaseBudget'
import type { FlowType, Transaction } from '@/lib/types'
import { QK } from '@/lib/queryKeys'

interface TransactionFilters {
  accountId?: string | null
  categoryId?: string
  categoryIds?: string[]
  flowType?: FlowType
  startDate?: string
  endDate?: string
  year?: number
  month?: number
  debugSource?: string
}

interface UseTransactionsOptions {
  enabled?: boolean
}

// debugSource est exclu de la queryKey pour éviter des clés non-partageables
function buildQueryKey(filters: TransactionFilters) {
  return [
    'transactions',
    {
      accountId: filters.accountId,
      categoryId: filters.categoryId,
      categoryIds: filters.categoryIds,
      flowType: filters.flowType,
      startDate: filters.startDate,
      endDate: filters.endDate,
      year: filters.year,
      month: filters.month,
    },
  ] as const
}

function isValidUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
}

const PAGE_SIZE = 1000
const MAX_ROWS = 3000

async function fetchTransactions(filters: TransactionFilters = {}): Promise<Transaction[]> {
  if (filters.accountId === null) {
    return []
  }

  if (typeof filters.accountId === 'string' && !isValidUuid(filters.accountId)) {
    return []
  }

  if (filters.categoryIds?.some((id) => !isValidUuid(id))) {
    return []
  }

  let query = budgetDb.from('transactions').select('*, category:categories(*), account:accounts(*)').eq('is_hidden', false)

  if (filters.accountId) query = query.eq('account_id', filters.accountId)
  if (filters.categoryIds && filters.categoryIds.length > 0) query = query.in('category_id', filters.categoryIds)
  else if (filters.categoryId) query = query.eq('category_id', filters.categoryId)
  if (filters.flowType) query = query.eq('flow_type', filters.flowType)
  if (filters.startDate) query = query.gte('transaction_date', filters.startDate)
  if (filters.endDate) query = query.lte('transaction_date', filters.endDate)

  if (filters.year && filters.month) {
    const start = `${filters.year}-${String(filters.month).padStart(2, '0')}-01`
    const end = new Date(filters.year, filters.month, 0).toISOString().slice(0, 10)
    query = query.gte('transaction_date', start).lte('transaction_date', end)
  }

  const allRows: Transaction[] = []
  let from = 0

  while (true) {
    const { data, error } = await query
      .order('transaction_date', { ascending: false })
      .range(from, from + PAGE_SIZE - 1)

    if (error) throw error

    const page = (data ?? []) as Transaction[]
    allRows.push(...page)

    if (allRows.length >= MAX_ROWS || page.length < PAGE_SIZE) break
    from += PAGE_SIZE
  }

  return allRows
}

export function useTransactions(filters: TransactionFilters = {}, options: UseTransactionsOptions = {}) {
  const { enabled = true } = options
  return useQuery({
    queryKey: buildQueryKey(filters),
    queryFn: () => fetchTransactions(filters),
    staleTime: 5 * 60_000,
    enabled,
  })
}

export function useCurrentMonthTransactions(year: number, month: number) {
  return useTransactions({ year, month })
}

// Invalide uniquement les queries transactions concernées par le compte touché.
// Les queries d'un autre compte (ex: Livret A après mutation sur compte courant)
// ne sont pas re-fetchées inutilement.
function invalidateTransactionsForAccount(queryClient: ReturnType<typeof useQueryClient>, accountId: string) {
  void queryClient.invalidateQueries({
    queryKey: [QK.TRANSACTIONS],
    predicate: (query) => {
      const filters = query.queryKey[1] as Record<string, unknown> | undefined
      if (!filters || typeof filters !== 'object') return true
      if (typeof filters.accountId === 'string' && filters.accountId !== accountId) return false
      return true
    },
  })
}

// Invalide tous les caches analytics dérivés des transactions.
// N'invalide PAS les tables de config statiques (categories, budget_periods, bucket_map)
// ni les données 2025 figées (annual-2025-analysis).
// React Query ne re-fetchera que les queries dont le subscriber est monté.
function invalidateAllAnalyticsCaches(queryClient: ReturnType<typeof useQueryClient>) {
  const keys = [
    QK.ACCOUNTS,
    QK.BUDGET_PAYLOAD,
    QK.BUDGET_ANALYTICS,
    QK.BUDGET_REVENUE_ANALYTICS,
    QK.BUDGETS,                          // useBudgets — calcule le dépensé depuis transactions
    QK.SAVINGS,                          // épargne (summary, analytics, financial-security)
    QK.STATS,                            // investment-performance, optimization-capacity
    QK.STATS_REFERENCE,                  // budget vs actual mensuel
    QK.ANNUAL_2026_ANALYSIS,
    QK.ANNUAL_PROJECTION_OVERVIEW_2026,
    QK.CATEGORY_ANNUAL_COST_PROJECTION_2026,
    QK.CATEGORY_ROLLING_12M_STATS,
    QK.COMPARED_YTD_FLOWS,
    QK.COMPARED_YTD_FLOWS_KPI_CARDS,
    QK.COMPARED_CATEGORY_SUMMARY,
    QK.COMPARED_BUCKET_SUMMARY,
    QK.MONTHLY_FLOWS_BY_SCOPE,
    QK.MONTHLY_FLOWS_ANALYSIS_CARD,
    QK.BUDGET_METRICS_PERIOD_DATASET,
    QK.BUDGET_METRICS_YEAR_DATASET,
    QK.BUDGET_METRICS_CATEGORIES,
  ] as const

  for (const key of keys) {
    void queryClient.invalidateQueries({ queryKey: [key] })
  }
}

export function useAddTransaction() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (txn: Omit<Transaction, 'id' | 'created_at' | 'updated_at' | 'category' | 'account'>) => {
      const { data, error } = await budgetDb.from('transactions').insert(txn).select().single()
      if (error) throw error
      return data
    },
    onSuccess: (_, txn) => {
      invalidateTransactionsForAccount(queryClient, txn.account_id)
      void queryClient.invalidateQueries({ queryKey: [QK.HOME, 'daily-budget-payload'] })
      void queryClient.invalidateQueries({ queryKey: [QK.HOME, 'trajectory'] })
      invalidateAllAnalyticsCaches(queryClient)
    },
  })
}

export function useUpdateTransaction() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<Transaction> }) => {
      const { data, error } = await budgetDb
        .from('transactions')
        .update(updates)
        .eq('id', id)
        .select()
        .single()
      if (error) throw error
      return data
    },
    onSuccess: (updated) => {
      if (updated?.account_id) {
        invalidateTransactionsForAccount(queryClient, updated.account_id)
      } else {
        void queryClient.invalidateQueries({ queryKey: [QK.TRANSACTIONS] })
      }
      void queryClient.invalidateQueries({ queryKey: [QK.HOME, 'daily-budget-payload'] })
      void queryClient.invalidateQueries({ queryKey: [QK.HOME, 'trajectory'] })
      invalidateAllAnalyticsCaches(queryClient)
    },
  })
}

export function useDeleteTransaction() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await budgetDb.from('transactions').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      // account_id inconnu après delete — invalidation large inévitable
      void queryClient.invalidateQueries({ queryKey: [QK.TRANSACTIONS] })
      void queryClient.invalidateQueries({ queryKey: [QK.HOME, 'daily-budget-payload'] })
      void queryClient.invalidateQueries({ queryKey: [QK.HOME, 'trajectory'] })
      invalidateAllAnalyticsCaches(queryClient)
    },
  })
}
