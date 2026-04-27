import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/types'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('[supabaseBudget] Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY in frontend env')
}

export const supabaseBudget = createClient<Database, 'budget_dashboard'>(supabaseUrl, supabaseAnonKey, {
  db: {
    schema: 'budget_dashboard',
  },
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
})
