import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { AccountWithBalance } from '@/lib/types'

async function fetchAccountsWithBalances(): Promise<AccountWithBalance[]> {
  const PAGE_SIZE = 1000
  const { data: accounts, error } = await supabase
    .from('accounts')
    .select('*')
    .eq('include_in_dashboard', true)
    .order('account_type')

  if (error) throw error
  if (!accounts || accounts.length === 0) return []

  const accountIds = accounts.map((account) => account.id)
  const txnsByAccount = new Map<string, number>()
  let from = 0

  while (true) {
    const { data: txns, error: txErr } = await supabase
      .from('transactions')
      .select('account_id, amount, direction')
      .in('account_id', accountIds)
      .eq('is_hidden', false)
      .order('transaction_date', { ascending: false })
      .range(from, from + PAGE_SIZE - 1)

    if (txErr) throw txErr

    const page = txns ?? []
    page.forEach((txn) => {
      const signedAmount = ['income', 'transfer_in'].includes(txn.direction) ? Number(txn.amount) : -Number(txn.amount)
      const prev = txnsByAccount.get(txn.account_id) ?? 0
      txnsByAccount.set(txn.account_id, prev + signedAmount)
    })

    if (page.length < PAGE_SIZE) break
    from += PAGE_SIZE
  }

  return accounts.map((account) => {
    const txBalance = txnsByAccount.get(account.id) ?? 0
    return {
      ...account,
      current_balance: Number(account.opening_balance ?? 0) + txBalance,
    }
  })
}

export function useAccounts() {
  return useQuery({
    queryKey: ['accounts'],
    queryFn: fetchAccountsWithBalances,
    staleTime: 30_000,
  })
}

export function useCheckingAccount(accounts: AccountWithBalance[] | undefined) {
  return accounts?.find((a) => a.account_type === 'checking') ?? null
}
