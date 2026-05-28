import { createClient } from '@supabase/supabase-js'
import type { Database } from './types'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('[supabase] Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY in frontend env')
}

export const supabase = createClient<Database, 'budget_dashboard'>(supabaseUrl, supabaseAnonKey, {
  db: {
    schema: 'budget_dashboard',
  },
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
  // Realtime n'est pas utilisé dans cette app (pas de subscriptions .channel()).
  // Désactiver la connexion WebSocket évite une connexion réseau inutile au démarrage.
  realtime: {
    params: { eventsPerSecond: 0 },
  },
})

declare global {
  interface Window {
    supabase?: typeof supabase
  }
}

if (import.meta.env.DEV && typeof window !== 'undefined') {
  window.supabase = supabase
}
