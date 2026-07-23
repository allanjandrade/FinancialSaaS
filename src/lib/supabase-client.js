import { createClient } from '@supabase/supabase-js'
import { FINANCE_STORAGE_KEY as STORAGE_KEY } from '@/lib/userScopedStorage.js'

export function initSupabase() {
  const url = import.meta.env.VITE_SUPABASE_URL
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

  if (!url || !anonKey) {
    if (import.meta.env.PROD) {
      console.error(
        '[Supabase] Defina VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY no ambiente de produção.',
      )
    }
    return null
  }

  window.SUPABASE_CONFIG = { url, anonKey }

  if (!window.supabase) {
    window.supabase = createClient(url, anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      },
      realtime: {
        params: { eventsPerSecond: 8 },
      },
    })
  }

  return window.supabase
}

export function getSupabaseClient() {
  return window.supabase || initSupabase()
}

export { STORAGE_KEY }
