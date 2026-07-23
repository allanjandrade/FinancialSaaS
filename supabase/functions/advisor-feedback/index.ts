import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { authErrorDetails, rejectIdentityOverride, requireAuthenticatedUser } from '../_shared/auth.ts'
import { authErrorResponse, corsHeaders, jsonResponse } from '../_shared/cors.ts'
import { userRestRequest } from '../_shared/finance-state.ts'
import { logSystemEvent, requestIds } from '../_shared/observability/logger.ts'
import { validateAdvisorFeedback } from '../_shared/predictive-engine/index.ts'

function errorResponse(error: unknown) {
  const auth = authErrorDetails(error)
  if (auth) return authErrorResponse(auth.code, auth.message, auth.status)
  return jsonResponse({ error: { code: 'ADVISOR_FEEDBACK_ERROR', message: error instanceof Error ? error.message : 'Feedback indisponivel.' } }, Number((error as any)?.status || 400))
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return jsonResponse({ error: { code: 'METHOD_NOT_ALLOWED', message: 'Metodo nao permitido.' } }, 405)
  const ids = requestIds(req)
  let userId: string | null = null
  try {
    const { user, token } = await requireAuthenticatedUser(req)
    userId = user.id
    const body = await req.json().catch(() => ({}))
    rejectIdentityOverride(body || {}, ['user_id', 'userId', 'family_id', 'familyId'])
    const feedback = validateAdvisorFeedback(body || {})
    const rows = await userRestRequest('advisor_feedback?select=id,recommendation_id,feedback,notes,created_at', token, {
      method: 'POST',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify({
        user_id: user.id,
        recommendation_id: feedback.recommendation_id,
        feedback: feedback.feedback,
        notes: feedback.notes,
      }),
    }) as Array<Record<string, unknown>>
    await logSystemEvent({ ...ids, userId, source: 'advisor', eventType: 'advisor_feedback_recorded', functionName: 'advisor-feedback', entityType: 'advisor_feedback', entityId: String(rows?.[0]?.id || '') })
    return jsonResponse({ feedback: rows?.[0] || null }, 201)
  } catch (error) {
    await logSystemEvent({ ...ids, userId, source: 'advisor', eventType: 'advisor_engine_failed', severity: 'error', status: 'failed', functionName: 'advisor-feedback', errorCode: (error as any)?.code, errorMessage: error instanceof Error ? error.message : 'unknown' })
    return errorResponse(error)
  }
})
