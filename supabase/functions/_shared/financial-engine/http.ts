import { authErrorDetails, rejectIdentityOverride, requireAuthenticatedUser } from '../auth.ts'
import { authErrorResponse, errorResponse, jsonResponse } from '../cors.ts'
import { loadAuthorizedFinanceState } from '../finance-state.ts'
import { logSystemEvent, requestIds } from '../observability/logger.ts'
import { requireFeatureAccess } from '../release10/feature-gate.ts'
import { normalizeFinanceState, requireReferenceDate } from './normalize-state.ts'

export async function handleFinancialEngineRequest(
  req: Request,
  compute: (
    state: ReturnType<typeof normalizeFinanceState>,
    body: Record<string, unknown>,
  ) => unknown,
  options: { requireDate?: boolean; errorMessage: string; featureKey?: string },
) {
  if (req.method !== 'POST') return errorResponse('Metodo nao permitido', 405)
  const ids = requestIds(req)
  const functionName = new URL(req.url).pathname.split('/').filter(Boolean).pop() || 'financial-engine'
  let userId: string | null = null
  let familyId: string | null = null
  try {
    const { token, user } = await requireAuthenticatedUser(req)
    userId = user.id
    const body = await req.json().catch(() => ({})) as Record<string, unknown>
    rejectIdentityOverride(body)
    if (options.featureKey) await requireFeatureAccess(user.id, options.featureKey)
    const row = await loadAuthorizedFinanceState(token, user.id, body.familyId ? String(body.familyId) : undefined)
    familyId = row.family_id
    const referenceDate = options.requireDate === false
      ? requireReferenceDate(body.referenceDate || String(row.updated_at || '1970-01-01').slice(0, 10))
      : requireReferenceDate(body.referenceDate)
    const state = normalizeFinanceState(row.data, referenceDate)
    const result = compute(state, body)
    await logSystemEvent({
      ...ids,
      userId,
      familyId,
      source: 'financial_engine',
      eventType: 'financial_engine_snapshot_generated',
      functionName,
      metadata: { reference_date: referenceDate },
    })
    return jsonResponse({
      familyId: row.family_id,
      updatedAt: row.updated_at,
      result,
    })
  } catch (error) {
    const auth = authErrorDetails(error)
    if (auth) {
      await logSystemEvent({
        ...ids,
        userId,
        familyId,
        source: 'financial_engine',
        eventType: 'financial_engine_failed',
        severity: 'warning',
        status: 'blocked',
        functionName,
        errorCode: auth.code,
        errorMessage: auth.message,
      })
      return authErrorResponse(auth.code, auth.message, auth.status)
    }
    const message = error instanceof Error ? error.message : 'Entrada invalida'
    await logSystemEvent({
      ...ids,
      userId,
      familyId,
      source: 'financial_engine',
      eventType: 'financial_engine_failed',
      severity: /deve|invalido|encontrado|maior que zero/i.test(message) ? 'warning' : 'error',
      status: 'failed',
      functionName,
      errorMessage: message,
    })
    if (/deve|invalido|encontrado|maior que zero/i.test(message)) return errorResponse(message, 400)
    return errorResponse(options.errorMessage, 500, message)
  }
}
