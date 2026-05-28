import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@/hooks/useAuth'
import { budgetDb } from '@/lib/supabaseBudget'
import { QK, STALE } from '@/lib/queryKeys'
import type { AccountBalanceStatus } from '@/features/home/types'

type RpcBalanceStatusRow = Record<string, unknown>

function toNullableNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function toStringValue(value: unknown, fallback = ''): string {
  return value == null ? fallback : String(value)
}

function toAccountBalanceStatus(row: RpcBalanceStatusRow): AccountBalanceStatus {
  return {
    account_id: toStringValue(row.account_id),
    account_name: toStringValue(row.account_name),
    observed_balance_amount: toNullableNumber(row.observed_balance_amount),
    deferred_card_outstanding_amount: toNullableNumber(row.deferred_card_outstanding_amount),
    observed_operational_balance_amount: toNullableNumber(row.observed_operational_balance_amount),
    observed_date: row.observed_date == null ? null : String(row.observed_date),
    estimated_balance_today: toNullableNumber(row.estimated_balance_today),
    projected_balance_eom: toNullableNumber(row.projected_balance_eom),
    actual_delta_since_observed: toNullableNumber(row.actual_delta_since_observed),
    future_planned_delta_eom: toNullableNumber(row.future_planned_delta_eom),
    as_of_date: toStringValue(row.as_of_date),
    month_end: toStringValue(row.month_end),
    confidence_level: toStringValue(row.confidence_level),
    source_label: toStringValue(row.source_label),
  }
}

function toLocalIsoDate(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function useAccountBalanceStatus(accountId: string | null, asOfDate?: string) {
  const { user } = useAuth()
  const resolvedDate = asOfDate ?? toLocalIsoDate(new Date())

  return useQuery<AccountBalanceStatus | null>({
    queryKey: [QK.HOME, 'account-balance-status', user?.id ?? null, accountId, resolvedDate],
    enabled: Boolean(user?.id && accountId),
    staleTime: STALE.LIVE,
    queryFn: async () => {
      if (!accountId) return null

      const { data, error } = await budgetDb.rpc('get_account_balance_status' as never, {
        p_account_id: accountId,
        p_as_of_date: resolvedDate,
      } as never)

      if (error) {
        throw new Error(`useAccountBalanceStatus: ${error.message}`)
      }

      const payload = data as unknown
      if (Array.isArray(payload)) {
        if (payload.length === 0) return null
        return toAccountBalanceStatus((payload[0] ?? {}) as RpcBalanceStatusRow)
      }

      if (payload && typeof payload === 'object') {
        return toAccountBalanceStatus(payload as RpcBalanceStatusRow)
      }

      return null
    },
  })
}
