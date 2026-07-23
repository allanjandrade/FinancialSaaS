import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { authErrorDetails, rejectIdentityOverride, requireAuthenticatedUser } from '../_shared/auth.ts'
import { authErrorResponse, corsHeaders, jsonResponse } from '../_shared/cors.ts'
import { userRestRequest } from '../_shared/finance-state.ts'
import { AutomationValidationError, validateAutomationActionPayload } from '../_shared/automations/schemas.ts'
import { assertFeatureEnabled } from '../_shared/observability/flags.ts'
import { assertOperationLimit } from '../_shared/observability/limits.ts'
import { logSystemEvent, requestIds } from '../_shared/observability/logger.ts'

function errorResponse(error: unknown) {
  const auth = authErrorDetails(error)
  if (auth) return authErrorResponse(auth.code, auth.message, auth.status)
  if (error instanceof AutomationValidationError || (error as any)?.code) {
    const value = error as any
    return jsonResponse({ error: { code: value.code || 'AUTOMATION_ERROR', message: value.message } }, value.status || 400)
  }
  console.error('AUTOMATION_CONFIG_FAILURE', error instanceof Error ? error.message : 'unknown')
  return jsonResponse({ error: { code: 'AUTOMATION_CONFIG_UNAVAILABLE', message: 'Automacoes temporariamente indisponiveis.' } }, 503)
}

async function listTemplates(token: string) {
  const rows = await userRestRequest(
    'automation_templates?select=id,name,description,category,parameter_schema,default_cooldown_hours&enabled=eq.true&order=name.asc',
    token,
  )
  return { templates: rows || [] }
}

async function listUserAutomations(token: string, userId: string, limit = 30) {
  const automations = await userRestRequest(
    `user_automations?select=id,template_id,name,parameters,status,timezone,cadence,cooldown_hours,next_run_at,last_evaluated_at,last_triggered_at,created_at,updated_at&user_id=eq.${userId}&order=created_at.desc`,
    token,
  )
  const runs = await userRestRequest(
    `automation_runs?select=id,automation_id,template_id,status,triggered,dedupe_key,result_payload,error_code,error_message,started_at,finished_at&user_id=eq.${userId}&order=started_at.desc&limit=${limit}`,
    token,
  )
  return { automations: automations || [], runs: runs || [] }
}

async function createAutomation(token: string, userId: string, input: any) {
  const templates = await userRestRequest(
    `automation_templates?select=id,default_cooldown_hours&enabled=eq.true&id=eq.${encodeURIComponent(input.templateId)}&limit=1`,
    token,
  ) as any[]
  if (!templates?.[0]) {
    throw new AutomationValidationError('Template nao encontrado ou desativado.', 'TEMPLATE_NOT_AVAILABLE', 404)
  }
  const rows = await userRestRequest('user_automations?select=id,template_id,name,parameters,status,timezone,cadence,cooldown_hours,next_run_at,last_evaluated_at,last_triggered_at,created_at,updated_at', token, {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify({
      user_id: userId,
      template_id: input.templateId,
      name: input.name,
      parameters: input.parameters,
      status: 'active',
      timezone: input.timezone,
      cadence: input.cadence,
      cooldown_hours: input.cooldownHours,
    }),
  }) as any[]
  return { automation: rows?.[0] || null }
}

async function updateAutomationStatus(token: string, userId: string, automationId: string, status: 'active' | 'paused') {
  const rows = await userRestRequest(
    `user_automations?select=id,template_id,name,parameters,status,timezone,cadence,cooldown_hours,next_run_at,last_evaluated_at,last_triggered_at,created_at,updated_at&id=eq.${encodeURIComponent(automationId)}&user_id=eq.${userId}`,
    token,
    {
      method: 'PATCH',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify({ status }),
    },
  ) as any[]
  if (!rows?.[0]) throw new AutomationValidationError('Automacao nao encontrada.', 'AUTOMATION_NOT_FOUND', 404)
  return { automation: rows[0] }
}

async function deleteAutomation(token: string, userId: string, automationId: string) {
  await userRestRequest(
    `user_automations?id=eq.${encodeURIComponent(automationId)}&user_id=eq.${userId}`,
    token,
    { method: 'DELETE' },
  )
  return { ok: true }
}

async function listNotifications(token: string, userId: string, limit = 30) {
  const notifications = await userRestRequest(
    `in_app_notifications?select=id,source,source_id,severity,title,message,payload,read_at,created_at&user_id=eq.${userId}&order=created_at.desc&limit=${limit}`,
    token,
  )
  return { notifications: notifications || [] }
}

async function markNotificationRead(token: string, userId: string, notificationId: string) {
  const rows = await userRestRequest(
    `in_app_notifications?select=id,source,source_id,severity,title,message,payload,read_at,created_at&id=eq.${encodeURIComponent(notificationId)}&user_id=eq.${userId}`,
    token,
    {
      method: 'PATCH',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify({ read_at: new Date().toISOString() }),
    },
  ) as any[]
  if (!rows?.[0]) throw new AutomationValidationError('Notificacao nao encontrada.', 'NOTIFICATION_NOT_FOUND', 404)
  return { notification: rows[0] }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return jsonResponse({ error: { code: 'METHOD_NOT_ALLOWED', message: 'Metodo nao permitido.' } }, 405)
  const ids = requestIds(req)
  let userId: string | null = null
  try {
    const { user, token } = await requireAuthenticatedUser(req)
    userId = user.id
    const body = await req.json().catch(() => null)
    rejectIdentityOverride(body || {}, ['user_id', 'userId', 'family_id', 'familyId'])
    await assertFeatureEnabled(user.id, 'automations_enabled')
    const input = validateAutomationActionPayload(body)
    if (input.action === 'list_templates') return jsonResponse(await listTemplates(token))
    if (input.action === 'list_user_automations') return jsonResponse(await listUserAutomations(token, user.id, input.limit))
    if (input.action === 'create_automation') {
      await assertOperationLimit(user.id, 'automations_limit')
      const result = await createAutomation(token, user.id, input)
      await logSystemEvent({ ...ids, userId: user.id, source: 'automation', eventType: 'automation_created', functionName: 'automation-config', entityType: 'user_automation', entityId: result.automation?.id, metadata: { template_id: input.templateId } })
      return jsonResponse(result, 201)
    }
    if (input.action === 'pause_automation') return jsonResponse(await updateAutomationStatus(token, user.id, input.automationId, 'paused'))
    if (input.action === 'resume_automation') return jsonResponse(await updateAutomationStatus(token, user.id, input.automationId, 'active'))
    if (input.action === 'delete_automation') return jsonResponse(await deleteAutomation(token, user.id, input.automationId))
    if (input.action === 'list_notifications') return jsonResponse(await listNotifications(token, user.id, input.limit))
    if (input.action === 'mark_notification_read') return jsonResponse(await markNotificationRead(token, user.id, input.notificationId))
    throw new AutomationValidationError('Acao nao permitida.')
  } catch (error) {
    await logSystemEvent({ ...ids, userId, source: 'automation', eventType: 'automation_config_blocked', severity: (error as any)?.status >= 500 ? 'error' : 'warning', status: (error as any)?.status >= 500 ? 'failed' : 'blocked', functionName: 'automation-config', errorCode: (error as any)?.code, errorMessage: error instanceof Error ? error.message : 'unknown' })
    return errorResponse(error)
  }
})
