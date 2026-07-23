import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { authErrorDetails, requireAuthenticatedUser } from '../_shared/auth.ts'
import { corsHeaders, authErrorResponse, jsonResponse } from '../_shared/cors.ts'
import { buildAiContext } from '../_shared/ai/context-builder.ts'
import { finalizeAiQuota, requireAiConsent, reserveAiQuota } from '../_shared/ai/database.ts'
import { AiAssistError, aiErrorResponse } from '../_shared/ai/errors.ts'
import { generateGeminiAnalysis } from '../_shared/ai/gemini.ts'
import { logAiInteraction } from '../_shared/ai/logging.ts'
import { runAiAssistFlow } from '../_shared/ai/orchestrator.js'
import { assertFeatureEnabled } from '../_shared/observability/flags.ts'
import { logSystemEvent, requestIds } from '../_shared/observability/logger.ts'

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return jsonResponse({ error: { code: 'METHOD_NOT_ALLOWED', message: 'Metodo nao permitido.' } }, 405)

  let authenticated: Awaited<ReturnType<typeof requireAuthenticatedUser>> | null = null
  let model: string | null = null
  const ids = requestIds(req)
  try {
    authenticated = await requireAuthenticatedUser(req)
    await assertFeatureEnabled(authenticated.user.id, 'ai_assist_enabled')
    await logSystemEvent({ ...ids, userId: authenticated.user.id, source: 'ai_assist', eventType: 'ai_assist_requested', functionName: 'ai-assist' })
    const payload = await req.json().catch(() => null)
    const response = await runAiAssistFlow(payload, {
      requireConsent: () => requireAiConsent(authenticated!.token, authenticated!.user.id),
      reserveQuota: () => reserveAiQuota(authenticated!.user.id),
      buildContext: (input: any) => buildAiContext(authenticated!.token, {
        ...input,
        userId: authenticated!.user.id,
      }),
      generate: async ({ input, context }: any) => {
        const generated = await generateGeminiAnalysis(input, context)
        model = generated.model
        return generated
      },
      finalizeQuota: (quota: any, usage: any) => finalizeAiQuota(
        authenticated!.user.id,
        String(quota.usage_date),
        Number(usage?.inputTokens || 0),
        Number(usage?.outputTokens || 0),
      ),
      log: ({ input, built, response: result, usage, status, error }: any) => logAiInteraction({
        userId: authenticated!.user.id,
        familyId: built?.familyId,
        contextType: input.contextType,
        userQuery: input.userQuery,
        model,
        status,
        response: result,
        usage,
        errorCode: error?.code || null,
      }),
      onLogError: (error: unknown) => {
        console.error('AI_ASSIST_AUDIT_LOG_FAILURE', error instanceof Error ? error.message : 'unknown')
      },
    })
    await logSystemEvent({ ...ids, userId: authenticated.user.id, source: 'ai_assist', eventType: 'ai_assist_completed', functionName: 'ai-assist' })
    return jsonResponse(response)
  } catch (error) {
    const authError = authErrorDetails(error)
    if (authError) {
      await logSystemEvent({ ...ids, userId: authenticated?.user.id, source: 'ai_assist', eventType: 'ai_assist_blocked', severity: 'warning', status: 'blocked', functionName: 'ai-assist', errorCode: authError.code, errorMessage: authError.message })
      return authErrorResponse(authError.code, authError.message, authError.status)
    }
    if (error instanceof AiAssistError) {
      await logSystemEvent({ ...ids, userId: authenticated?.user.id, source: 'ai_assist', eventType: error.code === 'AI_QUOTA_EXCEEDED' ? 'ai_assist_quota_exceeded' : 'ai_assist_failed', severity: error.status >= 500 ? 'error' : 'warning', status: error.status >= 500 ? 'failed' : 'blocked', functionName: 'ai-assist', errorCode: error.code, errorMessage: error.message })
      return aiErrorResponse(error)
    }
    if (error?.code && error?.status) {
      await logSystemEvent({ ...ids, userId: authenticated?.user.id, source: 'ai_assist', eventType: error.code === 'FEATURE_DISABLED' ? 'ai_assist_blocked_by_flag' : 'ai_assist_failed', severity: error.status >= 500 ? 'error' : 'warning', status: error.status >= 500 ? 'failed' : 'blocked', functionName: 'ai-assist', errorCode: error.code, errorMessage: error.message })
      return aiErrorResponse(new AiAssistError(error.code, error.message, error.status))
    }
    console.error('AI_ASSIST_FAILURE', error instanceof Error ? error.message : 'unknown')
    await logSystemEvent({ ...ids, userId: authenticated?.user.id, source: 'ai_assist', eventType: 'ai_assist_failed', severity: 'error', status: 'failed', functionName: 'ai-assist', errorMessage: error instanceof Error ? error.message : 'unknown' })
    return aiErrorResponse(new AiAssistError('AI_UNAVAILABLE', 'O assistente esta temporariamente indisponivel.', 503))
  }
})
