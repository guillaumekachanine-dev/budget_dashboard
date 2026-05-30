import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@/hooks/useAuth'
import { QK, STALE } from '@/lib/queryKeys'
import { budgetDb } from '@/lib/supabaseBudget'
import type { PlannedOperationItem } from '@/features/home/types'

function toLocalIsoDate(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function useUpcomingPlannedOperations(customEndDateStr?: string) {
  const { user } = useAuth()
  const userId = user?.id ?? null

  const now = new Date()
  const todayStr = toLocalIsoDate(now)

  const defaultEnd = new Date(now)
  defaultEnd.setDate(now.getDate() + 7)
  const endDateStr = customEndDateStr ?? toLocalIsoDate(defaultEnd)

  return useQuery<PlannedOperationItem[]>({
    queryKey: [QK.HOME, 'upcoming-planned-operations', userId, todayStr, endDateStr],
    enabled: Boolean(userId),
    staleTime: STALE.LIVE,
    queryFn: async (): Promise<PlannedOperationItem[]> => {
      if (!userId) return []

      // 1. Fetch planned occurrences from v_flux_operations_unified
      const { data: rawPlannedOps, error: errPlanned } = await budgetDb
        .from('v_flux_operations_unified')
        .select(
          'id,label,merchant_name,operation_date,amount,personal_amount,flow_type,budget_impact,budget_bucket,category_id,category_name,parent_category_name,is_recurring,recurrence_frequency,recurrence_day_of_month,source_planned_operation_id',
        )
        .eq('user_id', userId)
        .eq('is_planned_occurrence', true)
        .eq('planned_status', 'planned')
        .eq('is_matched', false)
        .gte('operation_date', todayStr)
        .lte('operation_date', endDateStr)

      if (errPlanned) throw errPlanned

      // 2. Fetch planned savings transfers from savings_planning_month_details
      const { data: rawSavingsPlans, error: errSavings } = await budgetDb
        .from('savings_planning_month_details' as never)
        .select(
          'id,period_year,period_month,planned_savings_amount,transfer_date,transfer_amount,destination_label,notes',
        )
        .eq('user_id', userId)
        .gte('transfer_date', todayStr)
        .lte('transfer_date', endDateStr)

      if (errSavings) throw errSavings

      const savingsPlans = (rawSavingsPlans as any[]) ?? []

      // 3. Check for realized savings transfers in those months
      const activeMonths = Array.from(
        new Set(
          savingsPlans.map(
            (sp: any) => `${sp.period_year}-${String(sp.period_month).padStart(2, '0')}`
          )
        )
      )

      const realizedSavingsByMonth = new Map<string, number>()
      if (activeMonths.length > 0) {
        const sortedMonths = [...activeMonths].sort()
        const startMonth = sortedMonths[0]
        const endMonth = sortedMonths[sortedMonths.length - 1]
        
        const firstDayStr = `${startMonth}-01`
        const endMonthParts = endMonth.split('-')
        const endYr = parseInt(endMonthParts[0], 10)
        const endMo = parseInt(endMonthParts[1], 10)
        const lastDay = new Date(endYr, endMo, 0).getDate()
        const lastDayStr = `${endMonth}-${String(lastDay).padStart(2, '0')}`

        const { data: rawActualSavings, error: errActualSavings } = await budgetDb
          .from('v_flux_operations_unified')
          .select('operation_date,personal_amount,amount,display_amount')
          .eq('user_id', userId)
          .eq('is_actual_transaction', true)
          .eq('flow_type', 'savings')
          .gte('operation_date', firstDayStr)
          .lte('operation_date', lastDayStr)

        if (errActualSavings) throw errActualSavings

        for (const tx of rawActualSavings ?? []) {
          const dateStr = tx.operation_date ? String(tx.operation_date) : ''
          if (!dateStr) continue
          const monthKey = dateStr.slice(0, 7) // "YYYY-MM"
          const amt = Math.abs(Number(tx.personal_amount ?? tx.display_amount ?? tx.amount ?? 0))
          realizedSavingsByMonth.set(monthKey, (realizedSavingsByMonth.get(monthKey) ?? 0) + amt)
        }
      }

      const mergedItems: PlannedOperationItem[] = []

      // Add planned operations from v_flux_operations_unified
      for (const row of rawPlannedOps ?? []) {
        mergedItems.push({
          id: String(row.id ?? ''),
          label: row.label ? String(row.label) : 'Opération planifiée',
          merchant_name: row.merchant_name ? String(row.merchant_name) : null,
          occurrence_date: String(row.operation_date ?? ''),
          planned_date: String(row.operation_date ?? ''),
          planned_amount: Number(row.amount ?? 0),
          planned_personal_amount: Number(row.personal_amount ?? row.amount ?? 0),
          flow_type: (row.flow_type || 'expense') as any,
          budget_impact: (row.budget_impact || 'already_budgeted') as any,
          budget_bucket: row.budget_bucket ? String(row.budget_bucket) : null,
          category_id: row.category_id ? String(row.category_id) : null,
          category_name: row.category_name ? String(row.category_name) : null,
          parent_category_name: row.parent_category_name ? String(row.parent_category_name) : null,
          is_recurring: row.is_recurring === true,
          recurrence_frequency: row.recurrence_frequency ? String(row.recurrence_frequency) : 'none',
          recurrence_day_of_month: row.recurrence_day_of_month ? Number(row.recurrence_day_of_month) : null,
          impacts_remaining_useful: false,
          remaining_useful_impact_amount: 0,
          source_planned_operation_id: row.source_planned_operation_id ? String(row.source_planned_operation_id) : undefined,
        })
      }

      // Add planned savings from savings_planning_month_details
      for (const sp of savingsPlans) {
        const monthKey = `${sp.period_year}-${String(sp.period_month).padStart(2, '0')}`
        const realizedAmt = realizedSavingsByMonth.get(monthKey) ?? 0
        const plannedAmt = Number(sp.transfer_amount ?? sp.planned_savings_amount ?? 0)
        
        // If already realized, skip this planned saving
        if (realizedAmt >= plannedAmt) {
          continue
        }

        mergedItems.push({
          id: `savings-plan-${sp.id}`,
          label: `Virement ${sp.destination_label || 'épargne'}`,
          merchant_name: null,
          occurrence_date: String(sp.transfer_date ?? ''),
          planned_date: String(sp.transfer_date ?? ''),
          planned_amount: plannedAmt,
          planned_personal_amount: plannedAmt,
          flow_type: 'savings',
          budget_impact: 'already_budgeted',
          budget_bucket: 'epargne',
          category_id: null,
          category_name: 'Virement épargne',
          parent_category_name: 'Épargne',
          is_recurring: false,
          recurrence_frequency: 'none',
          recurrence_day_of_month: null,
          impacts_remaining_useful: false,
          remaining_useful_impact_amount: 0,
        })
      }

      // Deduplicate items
      const seen = new Set<string>()
      const deduplicated: PlannedOperationItem[] = []

      for (const item of mergedItems) {
        // Unique key for planned operation:
        // For unified planned occurrences: source_planned_operation_id + '-' + planned_date
        // Otherwise: id
        const key = item.source_planned_operation_id
          ? `${item.source_planned_operation_id}-${item.planned_date}`
          : item.id

        if (seen.has(key)) {
          continue
        }
        seen.add(key)
        deduplicated.push(item)
      }

      // Sort by date ascending, then by label
      deduplicated.sort((a, b) => {
        const dateCompare = a.planned_date.localeCompare(b.planned_date)
        if (dateCompare !== 0) return dateCompare
        return a.label.localeCompare(b.label)
      })

      return deduplicated
    },
  })
}
