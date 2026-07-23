import { getSupabaseClient } from '@/lib/supabase-client.js'

export const SUPABASE_CONNECTIVITY_MESSAGE =
  'Não foi possível conectar ao Supabase. Verifique sua internet, VPN, firewall ou tente novamente em alguns instantes.'

const CONNECTIVITY_NAMES = new Set([
  'aborterror',
  'authretryablefetcherror',
  'functionsfetcherror',
  'timeouterror',
  'typeerror',
])

const CONNECTIVITY_PATTERNS = [
  'failed to fetch',
  'fetch failed',
  'networkerror',
  'network error',
  'err_connection_timed_out',
  'connection timed out',
  'timed out',
  'timeout',
  'load failed',
  'aborterror',
  'request was aborted',
]

function collectErrorText(error, seen = new Set()) {
  if (!error || seen.has(error)) return ''
  seen.add(error)
  if (typeof error === 'string') return error

  const parts = [
    error.name,
    error.code,
    error.message,
    error.statusText,
    error.details,
    error.hint,
    error.error_description,
  ]

  if (error.context && typeof error.context !== 'string') {
    parts.push(collectErrorText(error.context, seen))
  }
  if (error.cause && typeof error.cause !== 'string') {
    parts.push(collectErrorText(error.cause, seen))
  }
  if (error.error && typeof error.error !== 'string') {
    parts.push(collectErrorText(error.error, seen))
  }

  return parts.filter(Boolean).join(' ')
}

export function isSupabaseConnectivityError(error) {
  if (!error) return false
  const name = String(error.name || '').toLowerCase()
  const text = collectErrorText(error).toLowerCase()
  return CONNECTIVITY_NAMES.has(name) || CONNECTIVITY_PATTERNS.some((pattern) => text.includes(pattern))
}

export function friendlySupabaseError(error, fallback = 'Não foi possível concluir a ação.') {
  return isSupabaseConnectivityError(error)
    ? SUPABASE_CONNECTIVITY_MESSAGE
    : error?.message || fallback
}

export function mergeAbortSignals(...signals) {
  const activeSignals = signals.filter(Boolean)
  if (!activeSignals.length) return null

  const controller = new AbortController()
  const abort = () => {
    if (!controller.signal.aborted) controller.abort()
  }

  for (const signal of activeSignals) {
    if (signal.aborted) {
      abort()
      break
    }
    signal.addEventListener('abort', abort, { once: true })
  }

  return controller.signal
}

export function createRequestSignal(timeoutMs = 7000, parentSignal = null) {
  const controller = new AbortController()
  const timeoutId = timeoutMs
    ? setTimeout(() => {
      if (!controller.signal.aborted) controller.abort()
    }, timeoutMs)
    : null

  const abortFromParent = () => {
    if (!controller.signal.aborted) controller.abort()
  }

  if (parentSignal) {
    if (parentSignal.aborted) abortFromParent()
    else parentSignal.addEventListener('abort', abortFromParent, { once: true })
  }

  return {
    signal: controller.signal,
    cleanup() {
      if (timeoutId) clearTimeout(timeoutId)
      if (parentSignal) parentSignal.removeEventListener('abort', abortFromParent)
    },
  }
}

function sleep(ms, signal) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException('Request aborted', 'AbortError'))
      return
    }

    const timeoutId = setTimeout(resolve, ms)
    const abort = () => {
      clearTimeout(timeoutId)
      reject(new DOMException('Request aborted', 'AbortError'))
    }

    signal?.addEventListener('abort', abort, { once: true })
  })
}

export async function withRetry(operation, {
  attempts = 2,
  baseDelayMs = 300,
  signal = null,
  shouldRetry = isSupabaseConnectivityError,
} = {}) {
  let lastError = null
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    if (signal?.aborted) throw new DOMException('Request aborted', 'AbortError')
    try {
      return await operation({ attempt, signal })
    } catch (error) {
      lastError = error
      if (attempt >= attempts || !shouldRetry(error)) throw error
      await sleep(baseDelayMs * attempt, signal)
    }
  }
  throw lastError
}

export async function getActiveSession(supabase = getSupabaseClient()) {
  if (!supabase?.auth?.getSession) {
    return { session: null, user: null, error: null }
  }

  try {
    const { data, error } = await supabase.auth.getSession()
    if (error) throw error
    const session = data?.session || null
    return { session, user: session?.user || null, error: null }
  } catch (error) {
    return { session: null, user: null, error }
  }
}

export async function hasActiveSession(supabase = getSupabaseClient()) {
  const { session } = await getActiveSession(supabase)
  return Boolean(session?.user)
}

export async function invokeAuthenticatedFunction(functionName, options = {}, {
  supabase = getSupabaseClient(),
  signal = null,
  timeoutMs = 7000,
  attempts = 2,
} = {}) {
  if (!supabase?.functions?.invoke) {
    return {
      data: null,
      error: new Error('Supabase não inicializado.'),
      skipped: true,
      reason: 'missing-client',
    }
  }

  const { session, error: sessionError } = await getActiveSession(supabase)
  if (!session?.user) {
    return {
      data: null,
      error: sessionError,
      skipped: true,
      reason: sessionError ? 'session-error' : 'no-session',
    }
  }

  try {
    return await withRetry(async () => {
      const request = createRequestSignal(timeoutMs, signal)
      try {
        const result = await supabase.functions.invoke(functionName, {
          ...options,
          signal: request.signal,
          timeout: timeoutMs,
        })
        if (result?.error && isSupabaseConnectivityError(result.error)) {
          throw result.error
        }
        return {
          ...result,
          skipped: false,
          reason: null,
          session,
        }
      } finally {
        request.cleanup()
      }
    }, { attempts, signal })
  } catch (error) {
    return {
      data: null,
      error,
      skipped: false,
      reason: 'request-error',
      session,
    }
  }
}

export async function cleanupSupabaseRealtime(supabase = window.supabase) {
  if (!supabase) return []
  try {
    if (typeof supabase.removeAllChannels === 'function') {
      return await supabase.removeAllChannels()
    }

    const channels = typeof supabase.getChannels === 'function'
      ? supabase.getChannels()
      : supabase.realtime?.channels || []

    await Promise.all(
      channels.map((channel) => {
        if (typeof supabase.removeChannel === 'function') return supabase.removeChannel(channel)
        if (typeof channel.unsubscribe === 'function') return channel.unsubscribe()
        return null
      }),
    )
    return channels
  } catch (error) {
    console.warn('SUPABASE_REALTIME_CLEANUP_ERROR', error)
    return []
  }
}
