import { budgetDb } from '@/lib/supabaseBudget'

export async function resolvePeriodIdByYearMonth(periodYear: number, periodMonth: number): Promise<string> {
  const { data, error } = await budgetDb()
    .from('budget_periods')
    .select('id')
    .eq('period_year', periodYear)
    .eq('period_month', periodMonth)
    .limit(1)
    .maybeSingle()

  if (error) {
    throw new Error(`resolvePeriodIdByYearMonth failed: ${error.message}`)
  }

  if (!data?.id) {
    throw new Error(`Aucune période budgétaire trouvée pour ${String(periodMonth).padStart(2, '0')}/${periodYear}`)
  }

  return data.id
}

export function asSafeNumber(value: unknown): number {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}
