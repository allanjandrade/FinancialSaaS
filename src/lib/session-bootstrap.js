import { useAuthStore } from '@/stores/auth'
import { loadAuthenticatedContext } from '@/lib/authenticated-context.js'

let initializePromise = null

const AUTH_PUBLIC_PATHS = new Set([
  '/',
  '/login',
  '/signup',
  '/forgot-password',
  '/reset-password',
  '/auth/callback',
  '/privacy',
  '/terms',
  '/cookies',
  '/pricing',
])

function isPublicBootPath(pathname = window.location.pathname) {
  return AUTH_PUBLIC_PATHS.has(pathname) || pathname.startsWith('/legal/')
}

export async function initializeSession({ preloadAuthenticatedContext = true } = {}) {
  if (initializePromise) return initializePromise

  initializePromise = (async () => {
    const authStore = useAuthStore()
    await authStore.init()

    if (preloadAuthenticatedContext && authStore.isAuthenticated && !isPublicBootPath()) {
      await loadAuthenticatedContext({ preloadNotifications: true })
    }

    return authStore
  })().finally(() => {
    initializePromise = null
  })

  return initializePromise
}
