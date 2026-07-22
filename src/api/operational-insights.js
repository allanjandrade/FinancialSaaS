import { getSupabaseClient } from '@/lib/supabase-client.js'
import {
  createRequestSignal,
  friendlySupabaseError,
  getActiveSession,
  isSupabaseConnectivityError,
  withRetry,
} from '@/lib/supabase-auth.js'

export class OperationalApiError extends Error {
  constructor(code, message, status = 0) {
    super(message)
    this.name = 'OperationalApiError'
    this.code = code
    this.status = status
  }
}

async function postAuthenticatedFunction(functionName, payload = {}) {
  const supabase = getSupabaseClient()
  const { session, error } = await getActiveSession(supabase)
  const config = window.SUPABASE_CONFIG
  if (error || !session?.access_token) {
    throw new OperationalApiError('UNAUTHORIZED', 'Entre novamente para continuar.', 401)
  }

  return withRetry(async () => {
    const timeout = createRequestSignal(7000)
    try {
      const response = await fetch(`${config.url}/functions/v1/${functionName}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: config.anonKey,
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(payload),
        signal: timeout.signal,
      })
      const body = await response.json().catch(() => null)
      if (!response.ok) {
        throw new OperationalApiError(
          body?.error?.code || 'OPERATIONAL_UNAVAILABLE',
          body?.error?.message || 'Não foi possível carregar o painel operacional.',
          response.status,
        )
      }
      return body
    } catch (requestError) {
      if (isSupabaseConnectivityError(requestError)) throw requestError
      throw requestError
    } finally {
      timeout.cleanup()
    }
  }, { attempts: 2 }).catch((requestError) => {
    throw new OperationalApiError(
      isSupabaseConnectivityError(requestError) ? 'SUPABASE_CONNECTIVITY' : requestError?.code || 'OPERATIONAL_UNAVAILABLE',
      friendlySupabaseError(requestError, requestError?.message || 'Não foi possível carregar o painel operacional.'),
      requestError?.status || 0,
    )
  })
}

async function invokeOperational(action, payload = {}) {
  return postAuthenticatedFunction('operational-insights', { action, ...payload })
}

export const getOperationalSummary = (periodDays = 7) => invokeOperational('summary', { period_days: periodDays })
export const getRecentEvents = ({ periodDays = 7, limit = 50, source = '', severity = '' } = {}) => invokeOperational('recent_events', {
  period_days: periodDays,
  limit,
  ...(source ? { source } : {}),
  ...(severity ? { severity } : {}),
})
export const getErrorQueue = (periodDays = 7) => invokeOperational('error_queue', { period_days: periodDays, limit: 50 })
export const getAiActionsAudit = (periodDays = 7) => invokeOperational('ai_actions_audit', { period_days: periodDays, limit: 50 })
export const getAutomationsAudit = (periodDays = 7) => invokeOperational('automations_audit', { period_days: periodDays, limit: 50 })
export const exportDiagnostics = (periodDays = 7) => invokeOperational('export_diagnostics', { period_days: periodDays, limit: 50 })

export async function getHealthCheck() {
  return postAuthenticatedFunction('health-check', {})
}
