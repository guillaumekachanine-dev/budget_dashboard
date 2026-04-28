import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/types'

type TxnUserIdRow = { user_id: string }

export async function debugBudgetSupabaseConnection(
  supabase: SupabaseClient<Database, 'budget_dashboard'>,
) {
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession()

  console.log('[BUDGET DEBUG] sessionData:', sessionData)
  console.log('[BUDGET DEBUG] sessionError:', sessionError)

  const { data: userData, error: userError } = await supabase.auth.getUser()

  console.log('[BUDGET DEBUG] auth user:', userData?.user)
  console.log('[BUDGET DEBUG] auth user id:', userData?.user?.id)
  console.log('[BUDGET DEBUG] auth user email:', userData?.user?.email)
  console.log('[BUDGET DEBUG] auth error:', userError)

  const { data: transactions, error: transactionsError, status, statusText } = await supabase
    .schema('budget_dashboard')
    .from('transactions')
    .select('id, user_id, transaction_date, amount, direction, flow_type, normalized_label')
    .order('transaction_date', { ascending: false })
    .limit(10)

  console.log('[BUDGET DEBUG] transactions:', transactions)
  console.log('[BUDGET DEBUG] transactions count:', transactions?.length)
  console.log('[BUDGET DEBUG] transactions error:', transactionsError)
  console.log('[BUDGET DEBUG] transactions status:', status, statusText)

  const authUserId = userData?.user?.id

  if (!authUserId) {
    console.warn('[BUDGET DEBUG] No authenticated user. RLS policies using auth.uid() = user_id will return zero rows.')
  }

  if (authUserId && transactions?.length) {
    const distinctUserIds = [...new Set((transactions as TxnUserIdRow[]).map((t) => t.user_id))]
    console.log('[BUDGET DEBUG] distinct transaction user_ids:', distinctUserIds)
    console.log('[BUDGET DEBUG] auth uid matches returned rows:', distinctUserIds.every((id) => id === authUserId))
  }

  if (authUserId && transactions && transactions.length === 0) {
    console.warn('[BUDGET DEBUG] Auth user exists but no transactions returned. Likely causes: user_id mismatch in database, RLS policy issue, or no rows for this user.')
  }

  const referenceTables = [
    'accounts',
    'categories',
    'budget_periods',
    'budgets',
    'income_sources',
    'recurring_obligations',
  ]

  for (const table of referenceTables) {
    const { data, error, status: tableStatus, statusText: tableStatusText } = await supabase
      .schema('budget_dashboard')
      .from(table)
      .select('id, user_id')
      .limit(5)

    console.log(`[BUDGET DEBUG] ${table} data:`, data)
    console.log(`[BUDGET DEBUG] ${table} count:`, data?.length)
    console.log(`[BUDGET DEBUG] ${table} error:`, error)
    console.log(`[BUDGET DEBUG] ${table} status:`, tableStatus, tableStatusText)
  }
}
