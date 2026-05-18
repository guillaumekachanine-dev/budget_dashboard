import { useQuery } from '@tanstack/react-query'
import { getFinancialSecurityPayload } from '@/features/savings/api/getFinancialSecurityPayload'
import type { FinancialSecurityPayload } from '@/features/savings/types'

export function useFinancialSecurity() {
  const query = useQuery<FinancialSecurityPayload | null, Error>({
    queryKey: ['savings', 'financial-security'],
    queryFn: getFinancialSecurityPayload,
    staleTime: 60_000,
  })

  return {
    data: query.data ?? null,
    isLoading: query.isLoading,
    error: query.error ?? null,
  }
}
