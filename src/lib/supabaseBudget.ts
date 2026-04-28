import { supabase } from '@/lib/supabase'

export function budgetDb() {
  return supabase.schema('budget_dashboard')
}
