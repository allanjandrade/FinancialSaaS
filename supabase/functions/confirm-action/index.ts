import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { requireAuthenticatedUser, rejectIdentityOverride } from '../_shared/auth.ts'
import { corsHeaders, jsonResponse } from '../_shared/cors.ts'
import { assertAuthorizedFinanceEditor, loadAuthorizedFinanceState } from '../_shared/finance-state.ts'
import { requireAiConsent } from '../_shared/ai/database.ts'
import { validateActionPayload, validateConfirmationPayload } from '../_shared/ai-actions/schemas.ts'
import { applyAiAction } from '../_shared/ai-actions/executors.ts'
import { actionErrorResponse, cachedIdempotencyResponse, requireRpcSuccess, serviceRest, sha256 } from '../_shared/ai-actions/runtime.ts'
import { assertFeatureEnabled } from '../_shared/observability/flags.ts'
import { assertOperationLimit } from '../_shared/observability/limits.ts'
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
    rejectIdentityOverride(body || {}, ['user_id', 'userId', 'family_id', 'familyId', 'payload', 'action_type', 'finance_state'])
    await assertFeatureEnabled(user.id, 'ai_actions_enabled')
    await assertOperationLimit(user.id, 'ai_actions_daily_limit')
    await requireAiConsent(token, user.id)
    const input = validateConfirmationPayload(body, 'confirm')
    const requestHash = await sha256(body)
    const cached = await cachedIdempotencyResponse(user.id, input.idempotencyKey, requestHash)
    if (cached) return jsonResponse(cached)
    const drafts = await serviceRest(`ai_action_drafts?select=id,user_id,family_id,action_type,payload,status,expires_at&user_id=eq.${user.id}&id=eq.${input.draftId}&limit=1`) as any[]
    const draft = drafts?.[0]
    if (!draft) throw Object.assign(new Error('Rascunho nao encontrado.'), { code: 'INVALID_DRAFT', status: 404 })
    familyId = draft.family_id
    const payload = validateActionPayload(draft.action_type, draft.payload)
    const finance = await loadAuthorizedFinanceState(token, user.id, draft.family_id)
    await assertAuthorizedFinanceEditor(token, draft.family_id, user.id)
    const now = new Date().toISOString()
    const marker = crypto.randomUUID()
    const applied = applyAiAction(finance.data, draft.action_type, payload, { now, marker, entityId: crypto.randomUUID() })
    const rpc = await serviceRest('rpc/commit_ai_action', { method: 'POST', body: JSON.stringify({
      p_draft_id: draft.id, p_user_id: user.id, p_token_hash: await sha256(input.confirmationToken),
      p_idempotency_key: input.idempotencyKey, p_request_hash: requestHash, p_expected_updated_at: finance.updated_at,
      p_next_state: applied.state, p_fingerprint_before: await sha256(finance.data), p_fingerprint_after: await sha256(applied.state),
      p_entity_type: applied.entityType, p_entity_id: applied.entityId, p_result: applied.result, p_rollback_payload: applied.rollback,
    }) })
    const result = requireRpcSuccess(rpc)
    await logSystemEvent({ ...ids, userId, familyId, source: 'ai_action', eventType: 'ai_action_confirmed', functionName: 'confirm-action', entityType: applied.entityType, entityId: applied.entityId, metadata: { action_type: draft.action_type, log_id: result.log_id } })
    return jsonResponse(result)
  } catch (error) {
    await logSystemEvent({ ...ids, userId, familyId, source: 'ai_action', eventType: 'ai_action_confirm_blocked', severity: (error as any)?.status >= 500 ? 'error' : 'warning', status: (error as any)?.status >= 500 ? 'failed' : 'blocked', functionName: 'confirm-action', errorCode: (error as any)?.code, errorMessage: error instanceof Error ? error.message : 'unknown' })
    return actionErrorResponse(error)
  }
})
