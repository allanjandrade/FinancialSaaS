import { invokeAuthenticatedFunction } from '@/lib/supabase-auth.js'

export function googleAuthEnabled() {
  return import.meta.env.VITE_ENABLE_GOOGLE_AUTH === 'true'
}

export const GOOGLE_SIGNUP_BLOCKED_MESSAGE = 'Este e-mail não tem permissão para criar conta neste ambiente.'

export function publicSignupEnabled() {
  if (import.meta.env.PUBLIC_SIGNUP_ENABLED != null) {
    return import.meta.env.PUBLIC_SIGNUP_ENABLED === 'true'
  }
  if (import.meta.env.VITE_PUBLIC_SIGNUP_ENABLED != null) {
    return import.meta.env.VITE_PUBLIC_SIGNUP_ENABLED === 'true'
  }
  return false
}

export async function signInWithGoogle(supabase, options = {}) {
  if (!supabase?.auth?.signInWithOAuth) {
    throw new Error('Supabase não inicializado.')
  }

  const queryParams = options.legalAcceptanceVersion
    ? { legal_acceptance_version: options.legalAcceptanceVersion }
    : undefined

  return supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${window.location.origin}/auth/callback`,
      queryParams,
    },
  })
}

export function isNewOAuthUser(session = {}) {
  const user = session?.user
  if (!user?.created_at || !user?.last_sign_in_at) return false
  return new Date(user.created_at).getTime() === new Date(user.last_sign_in_at).getTime()
}

export async function validateGoogleSignupAccess(supabase, session = {}) {
  if (!googleAuthEnabled() || publicSignupEnabled() || !isNewOAuthUser(session)) {
    return { allowed: true }
  }

  const email = String(session?.user?.email || '').trim().toLowerCase()
  if (!email) return { allowed: false, message: GOOGLE_SIGNUP_BLOCKED_MESSAGE }

  try {
    const { data, error } = await invokeAuthenticatedFunction('tester-status', { body: { email } }, { supabase, timeoutMs: 6500, attempts: 2 })
    if (error) return { allowed: false, message: GOOGLE_SIGNUP_BLOCKED_MESSAGE }
    if (data?.active || data?.invite_allowed) return { allowed: true }
  } catch {
    return { allowed: false, message: GOOGLE_SIGNUP_BLOCKED_MESSAGE }
  }

  return { allowed: false, message: GOOGLE_SIGNUP_BLOCKED_MESSAGE }
}
