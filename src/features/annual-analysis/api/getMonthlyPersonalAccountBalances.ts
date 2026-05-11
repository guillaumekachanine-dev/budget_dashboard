import { budgetDb } from '@/lib/supabaseBudget'

const PERSONAL_MAIN_ACCOUNT_ID = 'bcffa4d1-92b0-4feb-a492-51ea328cfce2'

interface AccountBalanceMonthlyRow {
  balance_month: string | null
  balance_amount: number | null
  observed_date: string | null
  currency: string | null
  source: string | null
}

function monthKeyFromDate(value: string): string {
  return value.slice(0, 7)
}

export async function getMonthlyPersonalAccountBalances(year: number): Promise<Map<string, number>> {
  const { data, error } = await budgetDb
    .from('accounts_balance')
    .select('balance_month,balance_amount,observed_date,currency,source')
    .eq('account_id', PERSONAL_MAIN_ACCOUNT_ID)
    .gte('balance_month', `${year}-01-01`)
    .lte('balance_month', `${year}-12-31`)
    .order('balance_month', { ascending: true })

  if (error) {
    throw new Error(`getMonthlyPersonalAccountBalances failed: ${error.message}`)
  }

  const rows = (data ?? []) as unknown as AccountBalanceMonthlyRow[]
  const balancesByMonth = new Map<string, number>()

  for (const row of rows) {
    const balanceMonth = row.balance_month
    if (!balanceMonth || balanceMonth.length < 7) continue

    const amount = Number(row.balance_amount)
    if (!Number.isFinite(amount)) continue

    balancesByMonth.set(monthKeyFromDate(balanceMonth), amount)
  }

  return balancesByMonth
}
