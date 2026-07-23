import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { requireAuthenticatedUser, rejectIdentityOverride } from '../_shared/auth.ts'
import { corsHeaders, jsonResponse } from '../_shared/cors.ts'
import { loadAuthorizedFinanceState } from '../_shared/finance-state.ts'
import { requireAiConsent } from '../_shared/ai/database.ts'
import { buildActionPreview, validateProposePayload } from '../_shared/ai-actions/schemas.ts'
import { actionErrorResponse, AiActionError, confirmationToken, serviceRest, sha256, stableStringify } from '../_shared/ai-actions/runtime.ts'
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
    rejectIdentityOverride(body || {}, ['user_id', 'userId', 'family_id', 'familyId', 'context_payload', 'finance_state'])
    await assertFeatureEnabled(user.id, 'ai_actions_enabled')
    await assertOperationLimit(user.id, 'ai_actions_daily_limit')
    await requireAiConsent(token, user.id)
    const input = validateProposePayload(body)
    const finance = await loadAuthorizedFinanceState(token, user.id)
    familyId = finance.family_id
    const existing = await serviceRest(`ai_action_drafts?select=id,family_id,action_type,payload,preview,status,expires_at&user_id=eq.${user.id}&idempotency_key=eq.${encodeURIComponent(input.idempotencyKey)}&limit=1`) as any[]
    if (existing?.[0]) {
      const draft = existing[0]
      if (draft.action_type !== input.actionType || stableStringify(draft.payload) !== stableStringify(input.payload)) {
        throw new AiActionError('IDEMPOTENCY_CONFLICT', 'A chave de seguranca foi reutilizada com outra proposta.', 409)
      }
      const tokenValue = await confirmationToken(draft.id, user.id)
      await logSystemEvent({ ...ids, userId, familyId: draft.family_id, source: 'ai_action', eventType: 'ai_action_proposed', functionName: 'propose-action', entityType: 'ai_action_draft', entityId: draft.id, metadata: { cached: true, action_type: draft.action_type } })
      return jsonResponse({ draft, confirmation_token: tokenValue })
    }
    const draftId = crypto.randomUUID()
    const tokenValue = await confirmationToken(draftId, user.id)
    const row = {
      id: draftId, user_id: user.id, family_id: finance.family_id, action_type: input.actionType,
      payload: input.payload, preview: buildActionPreview(input.actionType, input.payload),
      token_hash: await sha256(tokenValue), idempotency_key: input.idempotencyKey,
      expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
    }
    const inserted = await serviceRest('ai_action_drafts?select=id,family_id,action_type,payload,preview,status,expires_at', { method: 'POST', headers: { Prefer: 'return=representation' }, body: JSON.stringify(row) }) as any[]
    await logSystemEvent({ ...ids, userId, familyId, source: 'ai_action', eventType: 'ai_action_proposed', functionName: 'propose-action', entityType: 'ai_action_draft', entityId: inserted[0]?.id, metadata: { action_type: input.actionType } })
    return jsonResponse({ draft: inserted[0], confirmation_token: tokenValue }, 201)
  } catch (error) {
    await logSystemEvent({ ...ids, userId, familyId, source: 'ai_action', eventType: 'ai_action_blocked', severity: (error as any)?.status >= 500 ? 'error' : 'warning', status: (error as any)?.status >= 500 ? 'failed' : 'blocked', functionName: 'propose-action', errorCode: (error as any)?.code, errorMessage: error instanceof Error ? error.message : 'unknown' })
    return actionErrorResponse(error)
  }
})
