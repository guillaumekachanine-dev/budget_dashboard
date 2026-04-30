import { budgetDb } from '@/lib/supabaseBudget'
import { asSafeNumber, resolvePeriodIdByYearMonth } from '@/features/stats/api/_shared'

export async function getBudgetGlobalVariableForPeriod(
  periodYear: number,
  periodMonth: number,
): Promise<number> {
  const periodId = await resolvePeriodIdByYearMonth(periodYear, periodMonth)

  const { data, error } = await budgetDb()
    .from('budgets')
    .select('amount')
    .eq('period_id', periodId)
    .eq('budget_kind', 'global_variable')
    .limit(1)
    .maybeSingle()

  if (error) {
    throw new Error(`getBudgetGlobalVariableForPeriod failed: ${error.message}`)
  }

  return asSafeNumber(data?.amount)
}
