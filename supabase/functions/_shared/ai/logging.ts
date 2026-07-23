import { aiRestRequest } from './database.ts'

function maskedSummary(value: string, maxLength: number) {
  return String(value || '')
    .replace(/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/g, '[email]')
    .replace(/https?:\/\/\S+/gi, '[url]')
    .replace(/\b\d{5,}\b/g, '[numero]')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength)
}

async function sha256(value: string) {
  const bytes = new TextEncoder().encode(value)
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(digest)).map((item) => item.toString(16).padStart(2, '0')).join('')
}

export async function logAiInteraction(params: {
  userId: string
  familyId?: string | null
  contextType: string
  userQuery: string
  model?: string | null
  status: string
  response?: Record<string, unknown> | null
  usage?: { inputTokens?: number; outputTokens?: number } | null
  errorCode?: string | null
}) {
  await aiRestRequest('ai_interactions', '', {
    method: 'POST',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({
      user_id: params.userId,
      family_id: params.familyId || null,
      interaction_type: 'contextual_read_only',
      provider: 'google',
      model: params.model || null,
      prompt_hash: await sha256(params.userQuery),
      response_status: params.status,
      metadata: {
        context_type: params.contextType,
        query_summary: maskedSummary(params.userQuery, 160),
        response_summary: maskedSummary(String(params.response?.answer || ''), 240),
        input_tokens: Number(params.usage?.inputTokens || 0),
        output_tokens: Number(params.usage?.outputTokens || 0),
        error_code: params.errorCode || null,
        read_only: true,
      },
    }),
  }, true)
}
