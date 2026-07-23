import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { requireAuthenticatedUser, rejectIdentityOverride } from '../_shared/auth.ts'
import { corsHeaders, jsonResponse } from '../_shared/cors.ts'
import { assertAuthorizedFinanceEditor, loadAuthorizedFinanceState } from '../_shared/finance-state.ts'
import { requireAiConsent } from '../_shared/ai/database.ts'
import { validateConfirmationPayload } from '../_shared/ai-actions/schemas.ts'
import { revertAiAction } from '../_shared/ai-actions/executors.ts'
import { actionErrorResponse, cachedIdempotencyResponse, requireRpcSuccess, serviceRest, sha256 } from '../_shared/ai-actions/runtime.ts'
import { assertFeatureEnabled } from '../_shared/observability/flags.ts'
import { logSystemEvent, requestIds } from '../_shared/observability/logger.ts'

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return jsonResponse({ error: { code: 'METHOD_NOT_ALLOWED', message: 'Metodo nao permitido.' } }, 405)
  const ids = requestIds(req)
  let userId: string | null = null
  let familyId: string | null = null
  try {
    const { user, token } = await requireAuthenticatedUser(req)
    userId = user.id
    const body = await req.json().catch(() => null)
    rejectIdentityOverride(body || {}, ['user_id', 'userId', 'family_id', 'familyId', 'rollback_payload', 'finance_state'])
    await assertFeatureEnabled(user.id, 'ai_actions_enabled')
    await requireAiConsent(token, user.id)
    const input = validateConfirmationPayload(body, 'revert')
    const requestHash = await sha256(body)
    const cached = await cachedIdempotencyResponse(user.id, input.idempotencyKey, requestHash)
    if (cached) return jsonResponse(cached)
    const logs = await serviceRest(`ai_action_logs?select=id,user_id,family_id,rollback_payload,reverted_at&user_id=eq.${user.id}&id=eq.${input.logId}&limit=1`) as any[]
    const log = logs?.[0]
    if (!log) throw Object.assign(new Error('Acao nao encontrada.'), { code: 'ACTION_LOG_NOT_FOUND', status: 404 })
    familyId = log.family_id
    const finance = await loadAuthorizedFinanceState(token, user.id, log.family_id)
    await assertAuthorizedFinanceEditor(token, log.family_id, user.id)
    const reverted = revertAiAction(finance.data, log.rollback_payload, new Date().toISOString())
    const rpc = await serviceRest('rpc/revert_ai_action', { method: 'POST', body: JSON.stringify({
      p_log_id: log.id, p_user_id: user.id, p_idempotency_key: input.idempotencyKey,
      p_request_hash: requestHash, p_expected_updated_at: finance.updated_at, p_next_state: reverted.state,
      p_fingerprint_after: await sha256(reverted.state), p_revert_result: reverted.result,
    }) })
    const result = requireRpcSuccess(rpc)
    await logSystemEvent({ ...ids, userId, familyId, source: 'ai_action', eventType: 'ai_action_reverted', functionName: 'revert-action', entityType: 'ai_action_log', entityId: log.id, metadata: { reverted: true } })
    return jsonResponse(result)
  } catch (error) {
    await logSystemEvent({ ...ids, userId, familyId, source: 'ai_action', eventType: 'ai_action_revert_blocked', severity: (error as any)?.status >= 500 ? 'error' : 'warning', status: (error as any)?.status >= 500 ? 'failed' : 'blocked', functionName: 'revert-action', errorCode: (error as any)?.code, errorMessage: error instanceof Error ? error.message : 'unknown' })
    return actionErrorResponse(error)
  }
})
