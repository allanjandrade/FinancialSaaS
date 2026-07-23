import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { authErrorDetails, rejectIdentityOverride, requireAuthenticatedUser } from '../_shared/auth.ts'
import { authErrorResponse, corsHeaders, jsonResponse } from '../_shared/cors.ts'
import { assertFeatureEnabled, getFeatureFlagForUser } from '../_shared/observability/flags.ts'
import { assertOperationLimit, getUserOperationLimits } from '../_shared/observability/limits.ts'
import { logSystemEvent, sanitizeMetadata } from '../_shared/observability/logger.ts'

const ACTIONS = new Set([
  'summary',
  'recent_events',
  'error_queue',
  'ai_actions_audit',
  'automations_audit',
  'export_diagnostics',
])

function serviceConfig() {
  const url = Deno.env.get('SUPABASE_URL')
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!url || !key) throw Object.assign(new Error('Configuracao indisponivel.'), { status: 500, code: 'SERVICE_CONFIG_MISSING' })
  return { url, key }
}

async function serviceRest(path: string, init: RequestInit = {}) {
  const { url, key } = serviceConfig()
  const response = await fetch(`${url}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      ...(init.headers || {}),
    },
  })
  const text = await response.text()
  const data = text ? JSON.parse(text) : null
  if (!response.ok) {
    throw Object.assign(new Error(data?.message || data?.error || `PostgREST ${response.status}`), {
      status: response.status,
      code: data?.code || 'REST_ERROR',
    })
  }
  return data
}

function inputError(message: string, code = 'INVALID_OPERATIONAL_PAYLOAD', status = 400) {
  throw Object.assign(new Error(message), { code, status })
}

function parseInput(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) inputError('Requisicao invalida.')
  const body = value as Record<string, unknown>
  rejectIdentityOverride(body, ['user_id', 'userId', 'family_id', 'familyId'])
  const unknown = Object.keys(body).find((key) => !['action', 'period_days', 'limit', 'source', 'severity'].includes(key))
  if (unknown) inputError(`Campo nao permitido: ${unknown}.`)
  const action = String(body.action || '')
  if (!ACTIONS.has(action)) inputError('Acao nao permitida.')
  const periodDays = body.period_days == null ? 7 : Number(body.period_days)
  if (!Number.isInteger(periodDays) || periodDays < 1 || periodDays > 90) inputError('period_days invalido.')
  const limit = body.limit == null ? 30 : Number(body.limit)
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) inputError('limit invalido.')
  const source = body.source == null ? '' : String(body.source)
  const severity = body.severity == null ? '' : String(body.severity)
  return { action, periodDays, limit, source, severity }
}

function since(days: number) {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()
}

function maskEvent(row: any) {
  return {
    id: row.id,
    source: row.source,
    event_type: row.event_type,
    severity: row.severity,
    status: row.status,
    function_name: row.function_name,
    request_id: row.request_id,
    correlation_id: row.correlation_id,
    entity_type: row.entity_type,
    entity_id: row.entity_id,
    error_code: row.error_code,
    error_message: row.error_message,
    metadata: sanitizeMetadata(row.metadata || {}),
    created_at: row.created_at,
  }
}

async function events(userId: string, input: ReturnType<typeof parseInput>, extra = '') {
  const filters = [
    `user_id=eq.${encodeURIComponent(userId)}`,
    `created_at=gte.${encodeURIComponent(since(input.periodDays))}`,
  ]
  if (input.source) filters.push(`source=eq.${encodeURIComponent(input.source)}`)
  if (input.severity) filters.push(`severity=eq.${encodeURIComponent(input.severity)}`)
  const rows = await serviceRest(
    `system_events?select=id,source,event_type,severity,status,function_name,request_id,correlation_id,entity_type,entity_id,error_code,error_message,metadata,created_at&${filters.join('&')}${extra}&order=created_at.desc&limit=${input.limit}`,
  ) as any[]
  return rows.map(maskEvent)
}

function countBy(rows: any[], field: string) {
  return rows.reduce((acc, row) => {
    const key = row[field] || 'unknown'
    acc[key] = (acc[key] || 0) + 1
    return acc
  }, {} as Record<string, number>)
}

async function summary(userId: string, input: ReturnType<typeof parseInput>) {
  const rows = await serviceRest(
    `system_events?select=source,severity,status,event_type,created_at&user_id=eq.${encodeURIComponent(userId)}&created_at=gte.${encodeURIComponent(since(input.periodDays))}&limit=1000`,
  ) as any[]
  const errors = rows.filter((row) => ['error', 'critical'].includes(row.severity) || row.status === 'failed')
  const blocked = rows.filter((row) => row.status === 'blocked')
  const [limits, operationalFlag, diagnosticsFlag] = await Promise.all([
    getUserOperationLimits(userId),
    getFeatureFlagForUser(userId, 'operational_panel_enabled'),
    getFeatureFlagForUser(userId, 'diagnostics_export_enabled'),
  ])
  return {
    period_days: input.periodDays,
    totals: {
      events: rows.length,
      errors: errors.length,
      blocked: blocked.length,
    },
    by_severity: countBy(rows, 'severity'),
    by_source: countBy(rows, 'source'),
    feature_flags: [operationalFlag, diagnosticsFlag],
    operation_limits: limits,
  }
}

async function aiAudit(userId: string, input: ReturnType<typeof parseInput>) {
  const rows = await serviceRest(
    `ai_action_logs?select=id,action_type,entity_type,entity_id,reverted_at,created_at&user_id=eq.${encodeURIComponent(userId)}&created_at=gte.${encodeURIComponent(since(input.periodDays))}&order=created_at.desc&limit=${input.limit}`,
  ) as any[]
  return rows || []
}

async function automationAudit(userId: string, input: ReturnType<typeof parseInput>) {
  const [automations, runs] = await Promise.all([
    serviceRest(`user_automations?select=id,template_id,name,status,created_at,last_evaluated_at,last_triggered_at&user_id=eq.${encodeURIComponent(userId)}&order=created_at.desc&limit=${input.limit}`),
    serviceRest(`automation_runs?select=id,automation_id,template_id,status,triggered,error_code,error_message,started_at&user_id=eq.${encodeURIComponent(userId)}&started_at=gte.${encodeURIComponent(since(input.periodDays))}&order=started_at.desc&limit=${input.limit}`),
  ])
  return { automations: automations || [], runs: runs || [] }
}

async function exportDiagnostics(userId: string, input: ReturnType<typeof parseInput>) {
  await assertFeatureEnabled(userId, 'diagnostics_export_enabled')
  await assertOperationLimit(userId, 'diagnostics_exports_daily_limit')
  const [summaryPayload, recentErrors, aiActions, automations] = await Promise.all([
    summary(userId, input),
    events(userId, { ...input, severity: 'error', limit: Math.min(input.limit, 50) }),
    aiAudit(userId, { ...input, limit: Math.min(input.limit, 50) }),
    automationAudit(userId, { ...input, limit: Math.min(input.limit, 50) }),
  ])
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(userId))
  const userHash = [...new Uint8Array(digest)].map((item) => item.toString(16).padStart(2, '0')).join('').slice(0, 24)
  const payload = {
    generated_at: new Date().toISOString(),
    user_id_hash: userHash,
    period_days: input.periodDays,
    feature_flags: summaryPayload.feature_flags,
    recent_errors: recentErrors,
    ai_actions_summary: {
      total: aiActions.length,
      reverted: aiActions.filter((item: any) => item.reverted_at).length,
      by_action: countBy(aiActions, 'action_type'),
    },
    automations_summary: {
      total: automations.automations.length,
      runs: automations.runs.length,
      triggered: automations.runs.filter((item: any) => item.triggered).length,
    },
    financial_validation_summary: {
      detailed_financial_data_included: false,
      transactions_included: false,
      complete_state_included: false,
    },
    environment: {
      app_version: '2.0.0',
      release: '6',
    },
  }
  await logSystemEvent({
    userId,
    source: 'system',
    eventType: 'diagnostics_exported',
    functionName: 'operational-insights',
    metadata: { period_days: input.periodDays },
  })
  return payload
}

function operationalError(error: unknown) {
  const auth = authErrorDetails(error)
  if (auth) return authErrorResponse(auth.code, auth.message, auth.status)
  const value = error as any
  const status = Number(value?.status || 503)
  const code = String(value?.code || 'OPERATIONAL_INSIGHTS_UNAVAILABLE')
  const message = error instanceof Error ? error.message : 'Operacional temporariamente indisponivel.'
  return jsonResponse({ error: { code, message } }, status)
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return jsonResponse({ error: { code: 'METHOD_NOT_ALLOWED', message: 'Metodo nao permitido.' } }, 405)
  try {
    const { user } = await requireAuthenticatedUser(req)
    await assertFeatureEnabled(user.id, 'operational_panel_enabled')
    const input = parseInput(await req.json().catch(() => null))
    if (input.action === 'summary') return jsonResponse({ summary: await summary(user.id, input) })
    if (input.action === 'recent_events') return jsonResponse({ events: await events(user.id, input) })
    if (input.action === 'error_queue') return jsonResponse({ events: await events(user.id, { ...input, limit: input.limit }, '&status=eq.failed') })
    if (input.action === 'ai_actions_audit') return jsonResponse({ ai_actions: await aiAudit(user.id, input) })
    if (input.action === 'automations_audit') return jsonResponse(await automationAudit(user.id, input))
    if (input.action === 'export_diagnostics') return jsonResponse({ diagnostics: await exportDiagnostics(user.id, input) })
    throw Object.assign(new Error('Acao nao permitida.'), { status: 400, code: 'INVALID_ACTION' })
  } catch (error) {
    return operationalError(error)
  }
})
