import { computed, ref } from 'vue'
import { resolveFrontendAccess } from '@/domain/access-control.js'
import { resolveEntitlements } from '@/domain/billing/entitlements.js'
import {
  SUPABASE_CONNECTIVITY_MESSAGE,
  friendlySupabaseError,
  getActiveSession,
  invokeAuthenticatedFunction,
  isSupabaseConnectivityError,
  mergeAbortSignals,
} from '@/lib/supabase-auth.js'
import { getSupabaseClient } from '@/lib/supabase-client.js'
import { listNotifications, resetNotificationsClientState } from '@/api/notifications.js'

const DEFAULT_ADMIN = Object.freeze({ is_admin: false, role: 'user', permissions: [] })

function readLocalSubscription() {
  try {
    return JSON.parse(localStorage.getItem('release10-subscription') || '{"status":"free","plan_code":"free"}')
  } catch {
    return { status: 'free', plan_code: 'free' }
  }
}

function defaultEntitlements() {
  return resolveEntitlements({ subscription: readLocalSubscription() })
}

const admin = ref({ ...DEFAULT_ADMIN })
const entitlements = ref(defaultEntitlements())
const loading = ref(false)
const lastWarning = ref('')
const lastError = ref(null)
const loadedUserId = ref(null)

const access = computed(() => resolveFrontendAccess({
  admin: admin.value,
  entitlements: entitlements.value,
}))

let loadPromise = null
let abortController = null
let contextVersion = 0

export function useAuthenticatedContext() {
  return {
    access,
    admin,
    entitlements,
    lastError,
    lastWarning,
    loading,
  }
}

export function abortAuthenticatedContext() {
  contextVersion += 1
  if (abortController && !abortController.signal.aborted) {
    abortController.abort()
  }
  abortController = null
  loadPromise = null
}

export function resetAuthenticatedContext() {
  abortAuthenticatedContext()
  admin.value = { ...DEFAULT_ADMIN }
  entitlements.value = defaultEntitlements()
  loading.value = false
  lastWarning.value = ''
  lastError.value = null
  loadedUserId.value = null
  resetNotificationsClientState()
}

function warningForResults(results) {
  const errors = results.map((result) => result?.error).filter(Boolean)
  if (!errors.length) return ''
  return errors.some(isSupabaseConnectivityError)
    ? SUPABASE_CONNECTIVITY_MESSAGE
    : friendlySupabaseError(errors[0], 'Não foi possível carregar todos os dados da conta.')
}

export async function loadAuthenticatedContext({
  force = false,
  signal = null,
  preloadNotifications = true,
} = {}) {
  const supabase = getSupabaseClient()
  const { session, error: sessionError } = await getActiveSession(supabase)

  if (!session?.user) {
    resetAuthenticatedContext()
    lastError.value = sessionError || null
    return {
      skipped: true,
      reason: sessionError ? 'session-error' : 'no-session',
      access: access.value,
      admin: admin.value,
      entitlements: entitlements.value,
      error: sessionError || null,
      warning: sessionError ? friendlySupabaseError(sessionError) : '',
    }
  }

  if (!force && loadedUserId.value === session.user.id && !loading.value) {
    return {
      skipped: false,
      reason: 'cached',
      access: access.value,
      admin: admin.value,
      entitlements: entitlements.value,
      error: lastError.value,
      warning: lastWarning.value,
    }
  }

  if (loadPromise && !force) return loadPromise

  abortAuthenticatedContext()
  abortController = new AbortController()
  const loadVersion = contextVersion
  const requestSignal = mergeAbortSignals(signal, abortController.signal) || abortController.signal
  loading.value = true
  lastWarning.value = ''
  lastError.value = null

  const currentLoad = (async () => {
    const [adminResult, entitlementsResult, notificationsResult] = await Promise.all([
      invokeAuthenticatedFunction('admin-current-user', {}, { supabase, signal: requestSignal, timeoutMs: 6500, attempts: 2 }),
      invokeAuthenticatedFunction('entitlements-resolve', {}, { supabase, signal: requestSignal, timeoutMs: 6500, attempts: 2 }),
      preloadNotifications
        ? listNotifications(20, { signal: requestSignal }).then((data) => ({ data, error: null })).catch((error) => ({ data: [], error }))
        : Promise.resolve({ data: [], error: null }),
    ])

    if (requestSignal.aborted || loadVersion !== contextVersion) {
      return {
        skipped: true,
        reason: 'aborted',
        access: access.value,
        admin: admin.value,
        entitlements: entitlements.value,
        error: null,
        warning: '',
      }
    }

    if (!adminResult?.error && adminResult?.data) admin.value = adminResult.data
    if (!entitlementsResult?.error && entitlementsResult?.data) entitlements.value = entitlementsResult.data

    const warning = warningForResults([adminResult, entitlementsResult, notificationsResult])
    lastWarning.value = warning
    lastError.value = adminResult?.error || entitlementsResult?.error || notificationsResult?.error || null
    loadedUserId.value = session.user.id

    return {
      skipped: false,
      reason: warning ? 'partial' : 'loaded',
      access: access.value,
      admin: admin.value,
      entitlements: entitlements.value,
      error: lastError.value,
      warning,
    }
  })()

  loadPromise = currentLoad
  const cleanupLoad = () => {
    if (loadPromise === currentLoad) {
      loading.value = false
      loadPromise = null
    }
  }
  currentLoad.then(cleanupLoad, cleanupLoad)

  return loadPromise
}
