import { AiAssistError } from './errors.ts'

function databaseConfig(serviceRole = false) {
  const url = Deno.env.get('SUPABASE_URL')
  const key = serviceRole
    ? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    : Deno.env.get('SUPABASE_ANON_KEY')
  if (!url || !key) throw new AiAssistError('AI_DATABASE_UNAVAILABLE', 'Configuracao do assistente indisponivel.', 503)
  return { url, key }
}

export async function aiRestRequest(
  path: string,
  token: string,
  init: RequestInit = {},
  serviceRole = false,
) {
  const { url, key } = databaseConfig(serviceRole)
  const authorization = serviceRole ? `Bearer ${key}` : `Bearer ${token}`
  const response = await fetch(`${url}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: key,
      Authorization: authorization,
      'Content-Type': 'application/json',
      ...(init.headers || {}),
    },
  })
  const text = await response.text()
  const data = text ? JSON.parse(text) : null
  if (!response.ok) {
    throw new AiAssistError('AI_DATABASE_ERROR', data?.message || data?.error || `PostgREST ${response.status}`, 503)
  }
  return data
}

export async function requireAiConsent(token: string, userId: string) {
  const rows = await aiRestRequest(
    `user_ai_settings?select=enabled,consent_version,consented_at,revoked_at&user_id=eq.${encodeURIComponent(userId)}&limit=1`,
    token,
  ) as Array<Record<string, unknown>>
  const setting = rows?.[0]
  if (!setting?.enabled || !setting.consented_at || setting.revoked_at) {
    throw new AiAssistError('CONSENT_REQUIRED', 'Ative o consentimento de IA nas configuracoes.', 403)
  }
  return setting
}

export async function reserveAiQuota(userId: string) {
  if (!Deno.env.get('GEMINI_API_KEY') || !Deno.env.get('GEMINI_MODEL_FAST')) {
    throw new AiAssistError('AI_NOT_CONFIGURED', 'O assistente ainda nao foi configurado.', 503)
  }
  const dailyLimit = Number(Deno.env.get('AI_DAILY_LIMIT') || 0)
  const monthlyLimit = Number(Deno.env.get('AI_MONTHLY_LIMIT') || 0)
  if (!Number.isInteger(dailyLimit) || dailyLimit < 1 || !Number.isInteger(monthlyLimit) || monthlyLimit < 1) {
    throw new AiAssistError('AI_NOT_CONFIGURED', 'Limites do assistente nao foram configurados.', 503)
  }
  const result = await aiRestRequest('rpc/reserve_ai_usage', '', {
    method: 'POST',
    body: JSON.stringify({
      p_user_id: userId,
      p_daily_limit: dailyLimit,
      p_monthly_limit: monthlyLimit,
    }),
  }, true) as Record<string, unknown>
  if (result?.allowed !== true) {
    const code = String(result?.code || 'AI_DAILY_LIMIT_REACHED')
    const message = code === 'AI_MONTHLY_LIMIT_REACHED'
      ? 'Limite mensal do assistente atingido.'
      : 'Limite diario do assistente atingido.'
    throw new AiAssistError(code, message, 429)
  }
  return result
}

export async function finalizeAiQuota(
  userId: string,
  usageDate: string,
  inputTokens: number,
  outputTokens: number,
) {
  await aiRestRequest('rpc/finalize_ai_usage', '', {
    method: 'POST',
    body: JSON.stringify({
      p_user_id: userId,
      p_usage_date: usageDate,
      p_input_tokens: inputTokens,
      p_output_tokens: outputTokens,
      p_estimated_cost: 0,
    }),
  }, true)
}
