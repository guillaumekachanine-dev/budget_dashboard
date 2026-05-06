import { supabase } from '@/lib/supabase'

const _budgetDb = supabase.schema('budget_dashboard')

export function budgetDb() {
  return _budgetDb
}
