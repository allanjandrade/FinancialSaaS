import { invokeAuthenticatedFunction } from '@/lib/supabase-auth.js'

export async function ensureActivePriceMonitoring() {
  const supabase = window.supabase
  if (!supabase) return null
  if (sessionStorage.getItem('active-price-monitor-configured') === 'true') return null

  const { data, error, skipped } = await invokeAuthenticatedFunction('price-monitor-run', {
    body: { action: 'configure' },
  }, { supabase, timeoutMs: 6500, attempts: 2 })
  if (skipped) return null
  if (error) throw error
  sessionStorage.setItem('active-price-monitor-configured', 'true')
  return data
}
