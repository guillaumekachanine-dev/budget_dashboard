import { useQuery } from '@tanstack/react-query'
import { getSavingsAccountsDisplay } from '@/features/savings/api/getSavingsAccountsDisplay'
import type { SavingsAccountDisplay } from '@/features/savings/types'

export function useSavingsAccountsDisplay() {
  const query = useQuery<SavingsAccountDisplay[], Error>({
    queryKey: ['savings', 'accounts-display'],
    queryFn: getSavingsAccountsDisplay,
    staleTime: 60_000,
  })

  return {
    data: query.data ?? [],
    isLoading: query.isLoading,
    error: query.error ?? null,
  }
}
