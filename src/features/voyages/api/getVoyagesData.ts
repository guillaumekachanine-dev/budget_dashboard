import { budgetDb } from '@/lib/supabaseBudget'
import type { Trip, TripTransaction } from '../types'

export async function getTrips(year: number): Promise<Trip[]> {
  const { data, error } = await budgetDb
    .from('trips')
    .select('*')
    .eq('year', year)
    .order('start_date', { ascending: true })

  if (error) throw new Error(`getTrips failed: ${error.message}`)
  return (data ?? []) as unknown as Trip[]
}

export async function getTripTransactions(tripIds: string[]): Promise<TripTransaction[]> {
  if (tripIds.length === 0) return []

  const { data, error } = await budgetDb
    .from('v_trip_transactions')
    .select('*')
    .in('trip_id', tripIds)

  if (error) throw new Error(`getTripTransactions failed: ${error.message}`)
  return (data ?? []) as unknown as TripTransaction[]
}
