import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { AccountWithBalance } from '@/lib/types'

async function fetchAccountsWithBalances(): Promise<AccountWithBalance[]> {
  const { data: accounts, error } = await supabase
    .from('accounts')
    .select('*')
    .eq('include_in_dashboard', true)
    .order('account_type')

  if (error) throw error

  const balancePromises = accounts.map(async (account) => {
    const { data: txns, error: txErr } = await supabase
      .from('transactions')
      .select('amount, direction')
      .eq('account_id', account.id)
      .eq('is_hidden', false)

    if (txErr) throw txErr

    const txBalance = (txns ?? []).reduce((sum, t) => {
      if (['income', 'transfer_in'].includes(t.direction)) return sum + Number(t.amount)
      return sum - Number(t.amount)
    }, 0)

    return {
      ...account,
      current_balance: Number(account.opening_balance ?? 0) + txBalance,
    }
  })

  return Promise.all(balancePromises)
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
