import { budgetDb } from '@/lib/supabaseBudget'
import { asSafeNumber, isValidUuid } from '@/features/stats/api/_shared'

export async function getBudgetGlobalVariableForPeriod(
  periodId: string | null,
): Promise<number> {
  if (!isValidUuid(periodId)) {
    return 0
  }

  const { data, error } = await budgetDb
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
