import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/types'

type TxnUserIdRow = { user_id: string }

export async function debugBudgetSupabaseConnection(
  supabase: SupabaseClient<Database, 'budget_dashboard'>,
) {
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession()
  const { data: userData, error: userError } = await supabase.auth.getUser()

  const { data: transactions, error: transactionsError, status, statusText } = await supabase
    .schema('budget_dashboard')
    .from('transactions')
    .select('id, user_id, transaction_date, amount, direction, flow_type, normalized_label')
    .order('transaction_date', { ascending: false })
    .limit(10)

  const authUserId = userData?.user?.id
  const warnings: string[] = []
  if (!authUserId) warnings.push('No authenticated user. RLS policies using auth.uid() = user_id will return zero rows.')

  let distinctUserIds: string[] = []
  let authUidMatchesReturnedRows = false
  if (authUserId && transactions?.length) {
    distinctUserIds = [...new Set((transactions as TxnUserIdRow[]).map((t) => t.user_id))]
    authUidMatchesReturnedRows = distinctUserIds.every((id) => id === authUserId)
  }

  if (authUserId && transactions && transactions.length === 0) {
    warnings.push('Auth user exists but no transactions returned. Likely causes: user_id mismatch in database, RLS policy issue, or no rows for this user.')
  }

  const referenceTables = [
    'accounts',
    'categories',
    'budget_periods',
    'budgets',
    'income_sources',
    'recurring_obligations',
  ]

  const tableChecks: Array<{
    table: string
    status: number
    statusText: string
    rowCount: number | undefined
    error: string | null
  }> = []
  for (const table of referenceTables) {
    const { data, error, status: tableStatus, statusText: tableStatusText } = await supabase
      .schema('budget_dashboard')
      .from(table)
      .select('id, user_id')
      .limit(5)
    tableChecks.push({
      table,
      status: tableStatus,
      statusText: tableStatusText,
      rowCount: data?.length,
      error: error?.message ?? null,
    })
  }

  return {
    sessionError: sessionError?.message ?? null,
    authUserId: authUserId ?? null,
    authError: userError?.message ?? null,
    transactionStatus: { status, statusText },
    transactionError: transactionsError?.message ?? null,
    transactionCount: transactions?.length ?? 0,
    distinctUserIds,
    authUidMatchesReturnedRows,
    tableChecks,
    warnings,
    sessionPresent: Boolean(sessionData?.session),
    userEmail: userData?.user?.email ?? null,
  }
}
