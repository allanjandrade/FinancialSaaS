import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { corsHeaders, jsonResponse } from '../_shared/cors.ts'
import { evaluateAutomationTemplate } from '../_shared/automations/evaluators.ts'
import {
  buildAutomationDedupeKey,
  buildNotificationPayload,
  isInCooldown,
  nextRunAt,
  normalizeRunResult,
} from '../_shared/automations/runner.ts'
import { assertOperationLimit } from '../_shared/observability/limits.ts'
import { logSystemEvent, requestIds } from '../_shared/observability/logger.ts'

type UserAutomation = {
  id: string
  user_id: string
  template_id: string
  name: string
  parameters: Record<string, unknown>
  cadence: 'hourly' | 'daily'
  cooldown_hours: number
  last_triggered_at?: string | null
}

type AutomationRun = {
  id: string
  automation_id: string
  user_id: string
  dedupe_key: string
  status: string
  triggered: boolean
  result_payload?: Record<string, unknown>
}

function serviceKey() {
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!key) throw Object.assign(new Error('Service role indisponivel.'), { status: 500, code: 'SERVICE_ROLE_MISSING' })
  return key
}

function serviceUrl() {
  const url = Deno.env.get('SUPABASE_URL')
  if (!url) throw Object.assign(new Error('URL do Supabase indisponivel.'), { status: 500, code: 'SUPABASE_URL_MISSING' })
  return url
}

function bearerToken(req: Request) {
  const authorization = req.headers.get('authorization') || ''
  const match = authorization.match(/^Bearer\s+(.+)$/i)
  if (!match?.[1]) throw Object.assign(new Error('Token de servico obrigatorio.'), { status: 401, code: 'UNAUTHORIZED' })
  return match[1].trim()
}

function decodeJwtPayload(token: string) {
  const payload = token.split('.')[1]
  if (!payload) throw Object.assign(new Error('Token de servico invalido.'), { status: 403, code: 'FORBIDDEN' })
  const normalized = payload.replace(/-/g, '+').replace(/_/g, '/')
  const padded = normalized.padEnd(normalized.length + (4 - normalized.length % 4) % 4, '=')
  return JSON.parse(atob(padded))
}

async function requireServiceRole(req: Request) {
  const token = bearerToken(req)
  const payload = decodeJwtPayload(token)
  if (payload?.role !== 'service_role') {
    throw Object.assign(new Error('Token de servico invalido.'), { status: 403, code: 'FORBIDDEN' })
  }
  const response = await fetch(`${serviceUrl()}/rest/v1/automation_templates?select=id&limit=1`, {
    headers: {
      apikey: serviceKey(),
      Authorization: `Bearer ${token}`,
    },
  })
  if (!response.ok) {
    throw Object.assign(new Error('Token de servico invalido.'), { status: 403, code: 'FORBIDDEN' })
  }
}

async function serviceRest(path: string, init: RequestInit = {}) {
  const response = await fetch(`${serviceUrl()}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: serviceKey(),
      Authorization: `Bearer ${serviceKey()}`,
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
      details: data,
    })
  }
  return data
}

async function claimDueAutomations(limit: number) {
  return await serviceRest('rpc/claim_due_automations', {
    method: 'POST',
    body: JSON.stringify({ p_limit: limit }),
  }) as UserAutomation[]
}

async function loadFinanceDataForUser(userId: string) {
  const members = await serviceRest(
    `family_members?select=family_id&user_id=eq.${encodeURIComponent(userId)}&limit=1`,
  ) as Array<{ family_id?: string }>
  const familyId = members?.[0]?.family_id
  if (!familyId) throw Object.assign(new Error('Familia nao encontrada para a automacao.'), { code: 'FAMILY_NOT_FOUND', status: 404 })

  const states = await serviceRest(
    `finance_states?select=family_id,user_id,data,updated_at&family_id=eq.${encodeURIComponent(familyId)}&user_id=eq.${encodeURIComponent(userId)}&limit=1`,
  ) as Array<{ family_id: string; user_id: string; data: Record<string, unknown>; updated_at?: string }>
  const state = states?.[0]
  if (!state?.data || state.user_id !== userId) throw Object.assign(new Error('Estado financeiro nao encontrado.'), { code: 'FINANCE_STATE_NOT_FOUND', status: 404 })
  return { familyId, financeData: state.data, updatedAt: state.updated_at || null }
}

async function findExistingRun(userId: string, dedupeKey: string) {
  const rows = await serviceRest(
    `automation_runs?select=id,automation_id,user_id,dedupe_key,status,triggered,result_payload&user_id=eq.${encodeURIComponent(userId)}&dedupe_key=eq.${encodeURIComponent(dedupeKey)}&limit=1`,
  ) as AutomationRun[]
  return rows?.[0] || null
}

async function insertRun(automation: UserAutomation, dedupeKey: string, payload: Record<string, unknown>) {
  const rows = await serviceRest('automation_runs?select=id,automation_id,user_id,dedupe_key,status,triggered', {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify({
      automation_id: automation.id,
      user_id: automation.user_id,
      template_id: automation.template_id,
      status: 'running',
      triggered: false,
      dedupe_key: dedupeKey,
      result_payload: payload,
    }),
  }) as AutomationRun[]
  return rows?.[0]
}

async function updateRun(runId: string, patch: Record<string, unknown>) {
  const rows = await serviceRest(
    `automation_runs?select=id,automation_id,user_id,dedupe_key,status,triggered&id=eq.${encodeURIComponent(runId)}`,
    {
      method: 'PATCH',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify(patch),
    },
  ) as AutomationRun[]
  return rows?.[0] || null
}

async function updateAutomationSchedule(
  automation: UserAutomation,
  now: Date,
  triggered: boolean,
) {
  const patch: Record<string, unknown> = {
    last_evaluated_at: now.toISOString(),
    next_run_at: nextRunAt(automation.cadence, now),
  }
  if (triggered) patch.last_triggered_at = now.toISOString()
  await serviceRest(`user_automations?id=eq.${encodeURIComponent(automation.id)}`, {
    method: 'PATCH',
    body: JSON.stringify(patch),
  })
}

async function insertNotification(automation: UserAutomation, evaluation: any, runId: string) {
  const rows = await serviceRest('in_app_notifications?select=id,source,source_id,title,severity,created_at', {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify(buildNotificationPayload(automation, evaluation, runId)),
  }) as Array<{ id: string }>
  return rows?.[0] || null
}

async function markDuplicate(existing: AutomationRun, now: Date) {
  const currentPayload = existing.result_payload && typeof existing.result_payload === 'object'
    ? existing.result_payload
    : {}
  await updateRun(existing.id, {
    result_payload: {
      ...currentPayload,
      duplicate_seen_at: now.toISOString(),
      message: 'Execucao duplicada ignorada pela chave de deduplicacao.',
    },
  })
}

async function processAutomation(automation: UserAutomation, referenceDate: string, now: Date) {
  let run: AutomationRun | null = null
  try {
    await assertOperationLimit(automation.user_id, 'automation_runs_daily_limit')
    await logSystemEvent({ userId: automation.user_id, source: 'automation', eventType: 'automation_run_started', functionName: 'run-automations', entityType: 'user_automation', entityId: automation.id, metadata: { template_id: automation.template_id } })
    const { financeData } = await loadFinanceDataForUser(automation.user_id)
    const evaluation = evaluateAutomationTemplate(
      automation.template_id,
      automation.parameters || {},
      financeData,
      { referenceDate },
    )
    const dedupeKey = buildAutomationDedupeKey(automation, evaluation, now)
    const existing = await findExistingRun(automation.user_id, dedupeKey)
    if (existing) {
      await markDuplicate(existing, now)
      await updateAutomationSchedule(automation, now, false)
      await logSystemEvent({ userId: automation.user_id, source: 'automation', eventType: 'automation_deduped', status: 'skipped', functionName: 'run-automations', entityType: 'user_automation', entityId: automation.id, metadata: { dedupe_key: dedupeKey } })
      return {
        automation_id: automation.id,
        status: 'skipped',
        code: 'DUPLICATE_DEDUPE_KEY',
        triggered: false,
        notification_created: false,
      }
    }

    run = await insertRun(automation, dedupeKey, {
      phase: 'running',
      started_by: 'run-automations',
    })
    const cooldown = Boolean(evaluation.triggered) && isInCooldown(
      automation.last_triggered_at,
      automation.cooldown_hours,
      now,
    )
    const normalized = normalizeRunResult(evaluation, cooldown)
    let notification = null
    if (normalized.status === 'success' && normalized.triggered) {
      notification = await insertNotification(automation, evaluation, run.id)
      await logSystemEvent({ userId: automation.user_id, source: 'automation', eventType: 'automation_notification_created', functionName: 'run-automations', entityType: 'automation_run', entityId: run.id, metadata: { template_id: automation.template_id, severity: evaluation.severity } })
    }
    await updateRun(run.id, {
      status: normalized.status,
      triggered: normalized.triggered,
      result_payload: normalized.resultPayload,
      finished_at: new Date().toISOString(),
    })
    await updateAutomationSchedule(automation, now, Boolean(notification))
    if (normalized.resultPayload?.code === 'COOLDOWN_ACTIVE') {
      await logSystemEvent({ userId: automation.user_id, source: 'automation', eventType: 'automation_cooldown_skipped', status: 'skipped', functionName: 'run-automations', entityType: 'automation_run', entityId: run.id, metadata: { template_id: automation.template_id } })
    }
    return {
      automation_id: automation.id,
      run_id: run.id,
      status: normalized.status,
      triggered: normalized.triggered,
      notification_created: Boolean(notification),
      code: normalized.resultPayload?.code || evaluation.code || null,
    }
  } catch (error) {
    const code = String((error as any)?.code || 'AUTOMATION_RUN_FAILED')
    const message = error instanceof Error ? error.message : 'Falha ao executar automacao.'
    if (run?.id) {
      await updateRun(run.id, {
        status: 'failed',
        triggered: false,
        error_code: code,
        error_message: message,
        finished_at: new Date().toISOString(),
      })
    } else {
      await serviceRest('automation_runs', {
        method: 'POST',
        body: JSON.stringify({
          automation_id: automation.id,
          user_id: automation.user_id,
          template_id: automation.template_id,
          status: 'failed',
          triggered: false,
          dedupe_key: `automation:${automation.id}:failure:${crypto.randomUUID()}`,
          result_payload: { code, message },
          error_code: code,
          error_message: message,
          finished_at: new Date().toISOString(),
        }),
      }).catch(() => null)
    }
    await updateAutomationSchedule(automation, now, false).catch(() => null)
    await logSystemEvent({ userId: automation.user_id, source: 'automation', eventType: 'automation_run_failed', severity: 'error', status: 'failed', functionName: 'run-automations', entityType: 'user_automation', entityId: automation.id, errorCode: code, errorMessage: message })
    return {
      automation_id: automation.id,
      status: 'failed',
      triggered: false,
      notification_created: false,
      code,
      message,
    }
  }
}

function parseBody(value: unknown) {
  const body = value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
  const unknown = Object.keys(body).find((key) => !['limit', 'reference_date'].includes(key))
  if (unknown) throw Object.assign(new Error(`Campo nao permitido: ${unknown}.`), { status: 400, code: 'INVALID_RUN_PAYLOAD' })
  const limit = body.limit == null ? 25 : Number(body.limit)
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
    throw Object.assign(new Error('limit invalido.'), { status: 400, code: 'INVALID_RUN_PAYLOAD' })
  }
  const today = new Date().toISOString().slice(0, 10)
  const referenceDate = body.reference_date == null ? today : String(body.reference_date)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(referenceDate)) {
    throw Object.assign(new Error('reference_date invalida.'), { status: 400, code: 'INVALID_RUN_PAYLOAD' })
  }
  return { limit, referenceDate }
}

function runErrorResponse(error: unknown) {
  const status = Number((error as any)?.status || 503)
  const code = String((error as any)?.code || 'RUN_AUTOMATIONS_UNAVAILABLE')
  const message = error instanceof Error ? error.message : 'Executor de automacoes indisponivel.'
  console.error('RUN_AUTOMATIONS_FAILURE', code, message)
  return jsonResponse({ error: { code, message } }, status)
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') {
    return jsonResponse({ error: { code: 'METHOD_NOT_ALLOWED', message: 'Metodo nao permitido.' } }, 405)
  }
  const ids = requestIds(req)
  try {
    await requireServiceRole(req)
    const input = parseBody(await req.json().catch(() => ({})))
    const now = new Date()
    const automations = await claimDueAutomations(input.limit)
    const processed = []
    for (const automation of automations || []) {
      processed.push(await processAutomation(automation, input.referenceDate, now))
    }
    return jsonResponse({
      ok: true,
      claimed: automations?.length || 0,
      processed,
    })
  } catch (error) {
    await logSystemEvent({ ...ids, source: 'automation', eventType: 'automation_runner_blocked', severity: (error as any)?.status >= 500 ? 'error' : 'warning', status: (error as any)?.status >= 500 ? 'failed' : 'blocked', functionName: 'run-automations', errorCode: (error as any)?.code, errorMessage: error instanceof Error ? error.message : 'unknown' })
    return runErrorResponse(error)
  }
})
