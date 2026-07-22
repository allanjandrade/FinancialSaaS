import { getSupabaseClient } from '@/lib/supabase-client.js'
import {
  createRequestSignal,
  friendlySupabaseError,
  getActiveSession,
  isSupabaseConnectivityError,
  mergeAbortSignals,
  withRetry,
} from '@/lib/supabase-auth.js'

let listPromise = null
let listAbortController = null

function client() {
  const supabase = getSupabaseClient()
  if (!supabase) throw new Error('Supabase não inicializado.')
  return supabase
}

export function resetNotificationsClientState() {
  if (listAbortController && !listAbortController.signal.aborted) {
    listAbortController.abort()
  }
  listAbortController = null
  listPromise = null
}

export async function listNotifications(limit = 20, { signal = null, force = false } = {}) {
  if (listPromise && !force) return listPromise

  const supabase = client()
  const { session } = await getActiveSession(supabase)
  if (!session?.user) return []

  listAbortController = new AbortController()
  const requestSignal = mergeAbortSignals(signal, listAbortController.signal) || listAbortController.signal

  listPromise = withRetry(async () => {
    const timeout = createRequestSignal(6500, requestSignal)
    try {
      let query = supabase
        .from('in_app_notifications')
        .select('id,source,source_id,severity,title,message,payload,read_at,created_at')
        .order('created_at', { ascending: false })
        .limit(limit)

      if (typeof query.abortSignal === 'function') {
        query = query.abortSignal(timeout.signal)
      }

      const { data, error } = await query
      if (error) {
        if (isSupabaseConnectivityError(error)) throw error
        throw new Error(error.message || 'Não foi possível carregar notificações.')
      }
      return data || []
    } finally {
      timeout.cleanup()
    }
  }, { attempts: 2, signal: requestSignal }).catch((error) => {
    throw new Error(friendlySupabaseError(error, 'Não foi possível carregar notificações.'))
  }).finally(() => {
    listPromise = null
    listAbortController = null
  })

  return listPromise
}

export async function markNotificationRead(notificationId) {
  const supabase = client()
  const { session } = await getActiveSession(supabase)
  if (!session?.user) return null

  const timeout = createRequestSignal(6500)
  let query = supabase
    .from('in_app_notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('id', notificationId)
    .select('id,source,source_id,severity,title,message,payload,read_at,created_at')
    .single()

  if (typeof query.abortSignal === 'function') {
    query = query.abortSignal(timeout.signal)
  }

  let result
  try {
    result = await query
  } finally {
    timeout.cleanup()
  }
  const { data, error } = result
  if (error) throw new Error(friendlySupabaseError(error, 'Não foi possível marcar como lida.'))
  return data
}
