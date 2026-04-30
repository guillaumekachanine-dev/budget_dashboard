import { budgetDb } from '@/lib/supabaseBudget'

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export function isValidUuid(value: string | null | undefined): value is string {
  if (!value) return false
  return UUID_REGEX.test(value)
}

export async function resolvePeriodIdByYearMonth(periodYear: number, periodMonth: number): Promise<string | null> {
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

  if (!data?.id) return null
  if (!isValidUuid(data.id)) return null
  return data.id
}

export function asSafeNumber(value: unknown): number {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}
