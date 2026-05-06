import { useQuery } from '@tanstack/react-query'
import { budgetDb } from '@/lib/supabaseBudget'
import type { AccountWithBalance } from '@/lib/types'

async function fetchAccountsWithBalances(): Promise<AccountWithBalance[]> {
  const [{ data: accounts, error: accErr }, { data: balances, error: balErr }] = await Promise.all([
    budgetDb().from('accounts').select('*').eq('include_in_dashboard', true).order('account_type'),
    budgetDb().from('account_balances').select('account_id, current_balance'),
  ])

  if (accErr) throw accErr
  if (balErr) throw balErr
  if (!accounts || accounts.length === 0) return []

  const balanceMap = new Map<string, number>(
    (balances ?? []).map((b) => [b.account_id, Number(b.current_balance)] as [string, number]),
  )

  return accounts.map((account) => ({
    ...account,
    current_balance: balanceMap.get(account.id) ?? 0,
  }))
}

export function useAccounts() {
  return useQuery({
    queryKey: ['accounts'],
    queryFn: fetchAccountsWithBalances,
    staleTime: 5 * 60_000,
  })
}

export function useCheckingAccount(accounts: AccountWithBalance[] | undefined) {
  return accounts?.find((a) => a.account_type === 'checking') ?? null
}
