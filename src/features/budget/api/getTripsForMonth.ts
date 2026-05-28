import { budgetDb } from '@/lib/supabaseBudget'
import type { Trip } from '@/features/voyages/types'

function lastDayOfMonth(year: number, month: number): string {
  const d = new Date(year, month, 0)
  const pad2 = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
}

export async function getTripsForMonth(year: number, month: number): Promise<Trip[]> {
  const pad2 = (n: number) => String(n).padStart(2, '0')
  const firstDay = `${year}-${pad2(month)}-01`
  const lastDay = lastDayOfMonth(year, month)

  const { data, error } = await budgetDb
    .from('trips')
    .select('id, user_id, name, start_date, end_date, year, emoji, notes, planned_budget, created_at, updated_at')
    .lte('start_date', lastDay)
    .gte('end_date', firstDay)
    .order('start_date', { ascending: true })

  if (error) throw new Error(`getTripsForMonth: ${error.message}`)
  return (data ?? []) as unknown as Trip[]
}
