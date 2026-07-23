import { authErrorDetails, rejectIdentityOverride, requireAuthenticatedUser } from '../auth.ts'
import { authErrorResponse, corsHeaders, jsonResponse } from '../cors.ts'
import { loadAuthorizedFinanceState } from '../finance-state.ts'
import { logSystemEvent, requestIds } from '../observability/logger.ts'
import { requireFeatureAccess } from '../release10/feature-gate.ts'

export function predictiveErrorResponse(error: unknown) {
  const auth = authErrorDetails(error)
  if (auth) return authErrorResponse(auth.code, auth.message, auth.status)
  const status = Number((error as any)?.status || 500)
  const message = error instanceof Error ? error.message : 'Erro ao processar consultor preditivo.'
  return jsonResponse({ error: { code: (error as any)?.code || 'PREDICTIVE_ENGINE_ERROR', message } }, status)
}

export async function handlePredictiveRequest(
  req: Request,
  functionName: string,
  requestedEvent: string,
  generatedEvent: string,
  handler: (state: Record<string, unknown>, body: Record<string, unknown>, userId: string) => Promise<unknown> | unknown,
  options: { featureKey?: string } = {},
) {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return jsonResponse({ error: { code: 'METHOD_NOT_ALLOWED', message: 'Metodo nao permitido.' } }, 405)

  const ids = requestIds(req)
  let userId: string | null = null
  try {
    const { user, token } = await requireAuthenticatedUser(req)
    userId = user.id
    const body = await req.json().catch(() => ({}))
    rejectIdentityOverride(body || {}, ['user_id', 'userId', 'family_id', 'familyId'])
    if (options.featureKey) await requireFeatureAccess(user.id, options.featureKey)
    await logSystemEvent({ ...ids, userId, source: 'advisor', eventType: requestedEvent, functionName })
    await logSystemEvent({ ...ids, userId, source: 'advisor', eventType: 'advisor_context_sanitized', functionName })
    const row = await loadAuthorizedFinanceState(token, user.id)
    const result = await handler(row.data, body || {}, user.id)
    await logSystemEvent({ ...ids, userId, source: 'advisor', eventType: generatedEvent, functionName, entityType: 'finance_state', entityId: row.family_id })
    return jsonResponse(result)
  } catch (error) {
    await logSystemEvent({
      ...ids,
      userId,
      source: 'advisor',
      eventType: 'advisor_engine_failed',
      severity: 'error',
      status: 'failed',
      functionName,
      errorCode: (error as any)?.code,
      errorMessage: error instanceof Error ? error.message : 'unknown',
    })
    return predictiveErrorResponse(error)
  }
}
