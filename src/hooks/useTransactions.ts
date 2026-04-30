import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { FlowType, Transaction } from '@/lib/types'

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

function isValidUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
}

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

  const PAGE_SIZE = 1000
  let query = supabase.from('transactions').select('*, category:categories(*), account:accounts(*)').eq('is_hidden', false)

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

    if (page.length < PAGE_SIZE) break
    from += PAGE_SIZE
  }

  return allRows
}

export function useTransactions(filters: TransactionFilters = {}, options: UseTransactionsOptions = {}) {
  const { enabled = true } = options
  return useQuery({
    queryKey: ['transactions', filters],
    queryFn: () => fetchTransactions(filters),
    staleTime: 30_000,
    enabled,
  })
}

export function useCurrentMonthTransactions(year: number, month: number) {
  return useTransactions({ year, month })
}

export function useAddTransaction() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (txn: Omit<Transaction, 'id' | 'created_at' | 'updated_at' | 'category' | 'account'>) => {
      const { data, error } = await supabase.from('transactions').insert(txn).select().single()
      if (error) throw error
      return data
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['transactions'] })
      void queryClient.invalidateQueries({ queryKey: ['accounts'] })
    },
  })
}
