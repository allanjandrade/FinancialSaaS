import { EdgeAuthError } from '../auth.ts'

export class AiActionError extends Error {
  code: string
  status: number
  constructor(code: string, message: string, status = 400) {
    super(message)
    this.name = 'AiActionError'
    this.code = code
    this.status = status
  }
}

export function actionErrorResponse(error: unknown) {
  if (error instanceof AiActionError || error instanceof EdgeAuthError || (error as any)?.code) {
    const value = error as any
    return new Response(JSON.stringify({ error: { code: value.code || 'AI_ACTION_ERROR', message: value.message } }), {
      status: value.status || 400,
      headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Content-Type': 'application/json' },
    })
  }
  console.error('AI_ACTION_FAILURE', error instanceof Error ? error.message : 'unknown')
  return new Response(JSON.stringify({ error: { code: 'AI_ACTION_UNAVAILABLE', message: 'A acao esta temporariamente indisponivel.' } }), { status: 503, headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' } })
}

export async function serviceRest(path: string, init: RequestInit = {}) {
  const url = Deno.env.get('SUPABASE_URL')
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!url || !key) throw new AiActionError('DATABASE_CONFIGURATION_ERROR', 'Configuracao do banco indisponivel.', 503)
  const response = await fetch(`${url}/rest/v1/${path}`, {
    ...init,
    headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', ...(init.headers || {}) },
  })
  const text = await response.text()
  const data = text ? JSON.parse(text) : null
  if (!response.ok) throw new AiActionError('AI_ACTION_DATABASE_ERROR', data?.message || `PostgREST ${response.status}`, 503)
  return data
}

export async function cachedIdempotencyResponse(userId: string, idempotencyKey: string, requestHash: string) {
  const rows = await serviceRest(
    `idempotency_keys?select=request_hash,status,response&user_id=eq.${userId}&idempotency_key=eq.${encodeURIComponent(idempotencyKey)}&limit=1`,
  ) as any[]
  const existing = rows?.[0]
  if (!existing) return null
  if (existing.request_hash !== requestHash) {
    throw new AiActionError('IDEMPOTENCY_CONFLICT', 'A chave de seguranca foi reutilizada com outro pedido.', 409)
  }
  return existing.status === 'succeeded' ? existing.response : null
}

export async function sha256(value: unknown) {
  const bytes = new TextEncoder().encode(typeof value === 'string' ? value : stableStringify(value))
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

export function stableStringify(value: any): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`
  if (value && typeof value === 'object') return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(',')}}`
  return JSON.stringify(value)
}

export async function confirmationToken(draftId: string, userId: string) {
  const secret = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!secret) throw new AiActionError('TOKEN_CONFIGURATION_ERROR', 'Confirmacao indisponivel.', 503)
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${draftId}:${userId}:release4-v1`))
  return `${draftId}.${[...new Uint8Array(signature)].map((byte) => byte.toString(16).padStart(2, '0')).join('')}`
}

export function requireRpcSuccess(result: any) {
  if (result?.ok === true) return result
  const errors: Record<string, [string, number]> = {
    INVALID_DRAFT: ['Rascunho invalido ou token incorreto.', 403], DRAFT_EXPIRED: ['A confirmacao expirou. Revise a acao novamente.', 409],
    DRAFT_ALREADY_EXECUTED: ['Esta acao ja foi executada.', 409], DRAFT_NOT_PENDING: ['Esta acao nao esta mais pendente.', 409],
    STATE_CHANGED: ['Os dados financeiros mudaram. Revise a acao antes de confirmar.', 409], IDEMPOTENCY_CONFLICT: ['A chave de seguranca foi reutilizada com outro pedido.', 409],
    ACTION_LOG_NOT_FOUND: ['Acao nao encontrada.', 404], ACTION_ALREADY_REVERTED: ['Esta acao ja foi revertida.', 409], FINANCE_STATE_NOT_FOUND: ['Estado financeiro nao encontrado.', 404],
    REVERT_CONFLICT: ['A entidade mudou depois da acao e nao pode ser revertida automaticamente.', 409],
  }
  const code = String(result?.code || 'AI_ACTION_DATABASE_ERROR')
  const [message, status] = errors[code] || ['Nao foi possivel concluir a acao.', 409]
  throw new AiActionError(code, message, status)
}
