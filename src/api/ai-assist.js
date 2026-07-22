import { getSupabaseClient } from '@/lib/supabase-client.js'

export class AiAssistApiError extends Error {
  constructor(code, message, status = 0) {
    super(message)
    this.name = 'AiAssistApiError'
    this.code = code
    this.status = status
  }
}

async function sessionContext() {
  const supabase = getSupabaseClient()
  if (!supabase) throw new AiAssistApiError('AI_NOT_CONFIGURED', 'Conexão com o assistente indisponível.')
  const { data, error } = await supabase.auth.getSession()
  if (error || !data?.session?.access_token) {
    throw new AiAssistApiError('UNAUTHORIZED', 'Entre novamente para usar o assistente.', 401)
  }
  return { supabase, session: data.session }
}

export async function askContextualAssistant({ contextType, entityId = null, userQuery }) {
  const { session } = await sessionContext()
  const config = window.SUPABASE_CONFIG
  if (!config?.url || !config?.anonKey) {
    throw new AiAssistApiError('AI_NOT_CONFIGURED', 'Conexão com o assistente indisponível.')
  }

  const response = await fetch(`${config.url}/functions/v1/ai-assist`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: config.anonKey,
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({
      context_type: contextType,
      entity_id: entityId,
      user_query: String(userQuery || '').trim(),
    }),
  })
  const body = await response.json().catch(() => null)
  if (!response.ok) {
    throw new AiAssistApiError(
      body?.error?.code || 'AI_UNAVAILABLE',
      body?.error?.message || 'O assistente está temporariamente indisponível.',
      response.status,
    )
  }
  return body
}

export async function getAiConsent() {
  const { supabase, session } = await sessionContext()
  const { data, error } = await supabase
    .from('user_ai_settings')
    .select('enabled, consent_version, consented_at, revoked_at')
    .eq('user_id', session.user.id)
    .maybeSingle()
  if (error) throw error
  return data || { enabled: false, consented_at: null, revoked_at: null }
}

export async function setAiConsent(enabled) {
  const { supabase, session } = await sessionContext()
  const now = new Date().toISOString()
  const { error } = await supabase.from('user_ai_settings').upsert({
    user_id: session.user.id,
    enabled: Boolean(enabled),
    consent_version: 'release3-v1',
    consented_at: enabled ? now : null,
    revoked_at: enabled ? null : now,
    updated_at: now,
  }, { onConflict: 'user_id' })
  if (error) throw error
  return { enabled: Boolean(enabled) }
}
