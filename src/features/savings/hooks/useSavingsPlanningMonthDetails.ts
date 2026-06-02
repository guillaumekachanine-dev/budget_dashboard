import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { budgetDb } from '@/lib/supabaseBudget'
import { QK, STALE } from '@/lib/queryKeys'
import { getCanonicalPeriod } from '@/lib/period'

export type SavingsPlanningMonthDetailsRow = {
  id: string
  user_id: string
  period_year: number
  period_month: number
  monthly_objective_amount: number
  planned_savings_amount: number
  transfer_date: string | null
  transfer_amount: number
  source_account_id: string | null
  source_account_label: string | null
  destination_account_id: string | null
  destination_label: string | null
  notes: string | null
}

export type SavingsPlanningMonthDetailsUpsert = {
  user_id: string
  period_year: number
  period_month: number
  monthly_objective_amount: number
  planned_savings_amount: number
  transfer_date: string | null
  transfer_amount: number
  source_account_id: string | null
  source_account_label: string | null
  destination_account_id: string | null
  destination_label: string | null
  notes: string | null
}

function toNumber(value: unknown): number {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function normalize(row: Record<string, unknown>): SavingsPlanningMonthDetailsRow {
  return {
    id: String(row.id ?? ''),
    user_id: String(row.user_id ?? ''),
    period_year: toNumber(row.period_year),
    period_month: toNumber(row.period_month),
    monthly_objective_amount: toNumber(row.monthly_objective_amount),
    planned_savings_amount: toNumber(row.planned_savings_amount),
    transfer_date: row.transfer_date ? String(row.transfer_date) : null,
    transfer_amount: toNumber(row.transfer_amount),
    source_account_id: row.source_account_id ? String(row.source_account_id) : null,
    source_account_label: row.source_account_label ? String(row.source_account_label) : null,
    destination_account_id: row.destination_account_id ? String(row.destination_account_id) : null,
    destination_label: row.destination_label ? String(row.destination_label) : null,
    notes: row.notes ? String(row.notes) : null,
  }
}

export function useSavingsPlanningMonthDetails(userId?: string, year = getCanonicalPeriod().currentYear) {
  return useQuery({
    queryKey: [QK.SAVINGS, 'planning-month-details', year, userId],
    enabled: Boolean(userId),
    staleTime: STALE.LIVE,
    queryFn: async (): Promise<SavingsPlanningMonthDetailsRow[]> => {
      const { data, error } = await budgetDb
        .from('savings_planning_month_details' as never)
        .select(
          'id,user_id,period_year,period_month,monthly_objective_amount,planned_savings_amount,transfer_date,transfer_amount,source_account_id,source_account_label,destination_account_id,destination_label,notes',
        )
        .eq('user_id', userId as string)
        .eq('period_year', year)
        .order('period_month', { ascending: true })

      if (error) throw error
      return (data ?? []).map((row) => normalize(row as Record<string, unknown>))
    },
  })
}

export function useUpsertSavingsPlanningMonthDetails() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (payload: SavingsPlanningMonthDetailsUpsert) => {
      const { data, error } = await budgetDb
        .from('savings_planning_month_details' as never)
        .upsert(payload as never, { onConflict: 'user_id,period_year,period_month' })
        .select(
          'id,user_id,period_year,period_month,monthly_objective_amount,planned_savings_amount,transfer_date,transfer_amount,source_account_id,source_account_label,destination_account_id,destination_label,notes',
        )
        .single()

      if (error) throw error
      return normalize(data as Record<string, unknown>)
    },
    onSuccess: (savedRow) => {
      // Invalide la query précise (clé complète) pour forcer le refetch immédiat.
      void queryClient.invalidateQueries({
        queryKey: [QK.SAVINGS, 'planning-month-details', savedRow.period_year, savedRow.user_id],
      })
      // Invalide les caches dérivés qui agrègent les données de planning.
      void queryClient.invalidateQueries({ queryKey: [QK.SAVINGS_ANALYTICS] })
      void queryClient.invalidateQueries({ queryKey: [QK.SAVINGS_CURRENT_SUMMARY] })
    },
  })
}
