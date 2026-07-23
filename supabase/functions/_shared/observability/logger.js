const PROHIBITED_METADATA_KEYS = new Set([
  'access_token',
  'refresh_token',
  'authorization',
  'apikey',
  'password',
  'secret',
  'jwt',
  'gemini_api_key',
  'openai_api_key',
  'raw_prompt',
  'full_finance_state',
])

const SOURCES = new Set([
  'edge_function',
  'frontend',
  'ai_assist',
  'ai_action',
  'automation',
  'financial_engine',
  'auth',
  'system',
])

const SEVERITIES = new Set(['debug', 'info', 'warning', 'error', 'critical'])
const STATUSES = new Set(['success', 'failed', 'blocked', 'skipped'])

function truncate(value, max = 500) {
  const text = String(value)
  return text.length > max ? `${text.slice(0, max)}...` : text
}

function safePrimitive(value) {
  if (typeof value === 'string') return truncate(value)
  if (typeof value === 'number' || typeof value === 'boolean' || value == null) return value
  return undefined
}

export function sanitizeMetadata(value, depth = 0) {
  if (depth > 4) return '[truncated]'
  const primitive = safePrimitive(value)
  if (primitive !== undefined) return primitive
  if (Array.isArray(value)) return value.slice(0, 25).map((item) => sanitizeMetadata(item, depth + 1))
  if (!value || typeof value !== 'object') return undefined
  const output = {}
  for (const [key, nested] of Object.entries(value)) {
    const normalized = key.toLowerCase()
    if (PROHIBITED_METADATA_KEYS.has(normalized)) continue
    if (normalized.includes('token') || normalized.includes('secret') || normalized.includes('password')) continue
    output[key] = sanitizeMetadata(nested, depth + 1)
  }
  return output
}

export function normalizeSystemEvent(input = {}) {
  const metadata = sanitizeMetadata(input.metadata || {})
  return {
    user_id: input.userId || input.user_id || null,
    family_id: input.familyId || input.family_id || null,
    source: SOURCES.has(input.source) ? input.source : 'system',
    event_type: truncate(input.eventType || input.event_type || 'unknown_event', 120),
    severity: SEVERITIES.has(input.severity) ? input.severity : 'info',
    status: STATUSES.has(input.status) ? input.status : 'success',
    function_name: input.functionName || input.function_name || null,
    request_id: input.requestId || input.request_id || null,
    correlation_id: input.correlationId || input.correlation_id || crypto.randomUUID(),
    entity_type: input.entityType || input.entity_type || null,
    entity_id: input.entityId || input.entity_id || null,
    error_code: input.errorCode || input.error_code || null,
    error_message: input.errorMessage || input.error_message ? truncate(input.errorMessage || input.error_message, 500) : null,
    metadata,
  }
}

async function defaultInsert(row) {
  const url = globalThis.Deno?.env.get('SUPABASE_URL')
  const key = globalThis.Deno?.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!url || !key) return
  await fetch(`${url}/rest/v1/system_events`, {
    method: 'POST',
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(row),
  })
}

export async function logSystemEvent(input = {}) {
  try {
    const row = normalizeSystemEvent(input)
    if (input.supabaseAdmin?.from) {
      await input.supabaseAdmin.from('system_events').insert(row)
      return row
    }
    await defaultInsert(row)
    return row
  } catch (error) {
    console.error('SYSTEM_EVENT_LOG_FAILURE', error instanceof Error ? error.message : 'unknown')
    return null
  }
}

export function requestIds(req) {
  return {
    requestId: req?.headers?.get?.('x-request-id') || crypto.randomUUID(),
    correlationId: req?.headers?.get?.('x-correlation-id') || crypto.randomUUID(),
  }
}
