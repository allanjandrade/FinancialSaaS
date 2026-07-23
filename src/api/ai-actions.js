import { getSupabaseClient } from '@/lib/supabase-client.js'

export class AiActionApiError extends Error {
  constructor(code, message, status = 0) { super(message); this.name = 'AiActionApiError'; this.code = code; this.status = status }
}

async function invoke(slug, body) {
  const supabase = getSupabaseClient()
  const { data, error } = await supabase.auth.getSession()
  const session = data?.session
  const config = window.SUPABASE_CONFIG
  if (error || !session?.access_token) throw new AiActionApiError('UNAUTHORIZED', 'Entre novamente para continuar.', 401)
  const response = await fetch(`${config.url}/functions/v1/${slug}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', apikey: config.anonKey, Authorization: `Bearer ${session.access_token}` }, body: JSON.stringify(body),
  })
  const payload = await response.json().catch(() => null)
  if (!response.ok) throw new AiActionApiError(payload?.error?.code || 'AI_ACTION_UNAVAILABLE', payload?.error?.message || 'Não foi possível concluir a ação.', response.status)
  return payload
}

const key = (prefix) => `${prefix}:${crypto.randomUUID()}`
export const proposeAiAction = ({ actionType, payload }) => invoke('propose-action', { action_type: actionType, payload, idempotency_key: key('propose') })
export const confirmAiAction = ({ draftId, confirmationToken }) => invoke('confirm-action', { draft_id: draftId, confirmation_token: confirmationToken, idempotency_key: key('confirm') })
export const revertAiAction = (logId) => invoke('revert-action', { log_id: logId, idempotency_key: key('revert') })

export async function listAiActionHistory(limit = 30) {
  const supabase = getSupabaseClient()
  const { data, error } = await supabase.from('ai_action_logs').select('id,action_type,entity_type,entity_id,result,reverted_at,created_at').order('created_at', { ascending: false }).limit(limit)
  if (error) throw error
  return data || []
}
