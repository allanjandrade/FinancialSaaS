import { AiAssistError } from './errors.ts'
import { AI_SYSTEM_INSTRUCTION, buildAiUserPrompt } from './prompt.ts'

const responseJsonSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    answer: { type: 'string' },
    confidence: { type: 'string', enum: ['low', 'medium', 'high'] },
    basis: { type: 'array', items: { type: 'string' }, maxItems: 6 },
    warnings: { type: 'array', items: { type: 'string' }, maxItems: 6 },
    suggested_questions: { type: 'array', items: { type: 'string' }, maxItems: 4 },
    suggested_actions: {
      type: 'array',
      maxItems: 4,
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          label: { type: 'string' },
          executable: { type: 'boolean' },
          action_type: { type: 'string', enum: ['create_transaction', 'update_transaction_category', 'mark_as_internal_transfer', 'add_to_wishlist', 'create_alert', 'create_recurring_rule'] },
          payload: { type: 'object' },
        },
        required: ['label', 'executable'],
      },
    },
  },
  required: ['answer', 'confidence', 'basis', 'warnings', 'suggested_questions', 'suggested_actions'],
}

export async function generateGeminiAnalysis(input: { contextType: string; userQuery: string }, context: unknown) {
  const apiKey = Deno.env.get('GEMINI_API_KEY')
  const model = Deno.env.get('GEMINI_MODEL_FAST')
  if (!apiKey || !model) {
    throw new AiAssistError('AI_NOT_CONFIGURED', 'O assistente ainda nao foi configurado.', 503)
  }

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      signal: AbortSignal.timeout(20000),
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: AI_SYSTEM_INSTRUCTION }] },
        contents: [{ role: 'user', parts: [{ text: buildAiUserPrompt(input, context) }] }],
        generationConfig: {
          temperature: 0.15,
          maxOutputTokens: 1200,
          responseMimeType: 'application/json',
          responseJsonSchema,
        },
      }),
    },
  ).catch((error) => {
    if (error?.name === 'TimeoutError') throw new AiAssistError('AI_TIMEOUT', 'O assistente demorou mais que o esperado.', 504)
    throw new AiAssistError('AI_UNAVAILABLE', 'O assistente esta temporariamente indisponivel.', 503)
  })

  const body = await response.json().catch(() => null)
  if (!response.ok) {
    const code = response.status === 429 ? 'AI_PROVIDER_QUOTA' : 'AI_UNAVAILABLE'
    throw new AiAssistError(code, 'O assistente esta temporariamente indisponivel.', response.status === 429 ? 503 : 502)
  }

  const rawText = body?.candidates?.[0]?.content?.parts?.map((part: any) => part?.text || '').join('') || ''
  let data
  try { data = JSON.parse(rawText) } catch { data = null }
  return {
    data,
    usage: {
      inputTokens: Number(body?.usageMetadata?.promptTokenCount || 0),
      outputTokens: Number(body?.usageMetadata?.candidatesTokenCount || 0),
    },
    model,
  }
}
