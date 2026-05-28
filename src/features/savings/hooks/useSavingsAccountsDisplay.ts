import { QK, STALE } from '@/lib/queryKeys'
import { useQuery } from '@tanstack/react-query'
import { getSavingsAccountsDisplay } from '@/features/savings/api/getSavingsAccountsDisplay'
import type { SavingsAccountDisplay } from '@/features/savings/types'

export function useSavingsAccountsDisplay() {
  const query = useQuery<SavingsAccountDisplay[], Error>({
    queryKey: [QK.SAVINGS_ACCOUNTS_DISPLAY],
    queryFn: getSavingsAccountsDisplay,
    staleTime: STALE.ANALYTICS,
  })

  return {
    data: query.data ?? [],
    isLoading: query.isLoading,
    error: query.error ?? null,
  }
}
