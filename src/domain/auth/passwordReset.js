import { validateStrongPassword } from '@/domain/auth/passwordPolicy.js'

export async function requestPasswordReset(supabase, email) {
  const normalizedEmail = String(email || '').trim()
  if (!normalizedEmail || !normalizedEmail.includes('@')) {
    throw new Error('Informe um e-mail valido.')
  }
  if (!supabase?.auth?.resetPasswordForEmail) {
    throw new Error('Supabase não inicializado.')
  }

  return supabase.auth.resetPasswordForEmail(normalizedEmail, {
    redirectTo: `${window.location.origin}/reset-password`,
  })
}

export async function updatePassword(supabase, password, confirmPassword) {
  validateStrongPassword(password)
  if (password !== confirmPassword) {
    throw new Error('As senhas não conferem.')
  }
  if (!supabase?.auth?.updateUser) {
    throw new Error('Supabase não inicializado.')
  }

  return supabase.auth.updateUser({ password })
}

export function readRecoveryParams(hash = window.location.hash) {
  const params = new URLSearchParams(String(hash || '').replace(/^#/, ''))
  return {
    accessToken: params.get('access_token') || '',
    refreshToken: params.get('refresh_token') || '',
    type: params.get('type') || '',
    error: params.get('error') || '',
  }
}

export function clearPasswordResetUrl() {
  if (!window?.history?.replaceState) return
  window.history.replaceState({}, document.title, `${window.location.pathname}${window.location.search}`)
}

export async function preparePasswordRecoverySession(supabase) {
  const params = readRecoveryParams()
  if (params.error) throw new Error('Link de redefinição inválido ou expirado.')
  if (!params.accessToken || !params.refreshToken) return { recovered: false }
  if (!supabase?.auth?.setSession) throw new Error('Supabase não inicializado.')

  const { data, error } = await supabase.auth.setSession({
    access_token: params.accessToken,
    refresh_token: params.refreshToken,
  })
  clearPasswordResetUrl()
  if (error) throw error
  return { recovered: true, session: data?.session || null }
}
