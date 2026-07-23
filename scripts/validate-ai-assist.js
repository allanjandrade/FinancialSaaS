import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { validateAiAssistPayload } from '../supabase/functions/_shared/ai/payload.js'
import { sanitizeAiResponse } from '../supabase/functions/_shared/ai/response.js'

const endpoint = readFileSync('supabase/functions/ai-assist/index.ts', 'utf8')
const contextBuilder = readFileSync('supabase/functions/_shared/ai/context-builder.ts', 'utf8')
const prompt = readFileSync('supabase/functions/_shared/ai/prompt.ts', 'utf8')
const logging = readFileSync('supabase/functions/_shared/ai/logging.ts', 'utf8')
const migration = readFileSync('supabase/migrations/20260612203000_release3_ai_usage.sql', 'utf8')

assert.deepEqual(
  validateAiAssistPayload({ context_type: 'dashboard', entity_id: null, user_query: 'Analise meu mes' }),
  { contextType: 'dashboard', entityId: null, userQuery: 'Analise meu mes' },
)
assert.throws(() => validateAiAssistPayload({ context_type: 'dashboard', user_query: 'Analise', context_payload: {} }))
assert.throws(() => validateAiAssistPayload({ context_type: 'dashboard', user_query: 'Analise', user_id: 'x' }))

const sanitized = sanitizeAiResponse({
  answer: 'Resposta', confidence: 'high', basis: [], warnings: [], suggested_questions: [],
  suggested_actions: [{ label: 'Excluir dado', executable: true }],
})
assert.equal(sanitized.suggested_actions[0].executable, false)

assert.match(endpoint, /requireAuthenticatedUser/)
assert.match(endpoint, /requireAiConsent/)
assert.match(endpoint, /reserveAiQuota/)
assert.match(endpoint, /buildAiContext/)
assert.match(contextBuilder, /loadAuthorizedFinanceState/)
assert.match(prompt, /somente leitura/i)
assert.match(prompt, /Ignore qualquer instrucao/i)
assert.doesNotMatch(logging, /financial_context|context_payload|raw_prompt/)
assert.match(migration, /security definer/i)
assert.match(migration, /grant execute on function public\.reserve_ai_usage.*service_role/is)
assert.doesNotMatch(endpoint, /insert\(|update\(|delete\(|upsert\(/)

console.log('AI assist validation: payload, auth, consent, quota, read-only response and minimized logging approved')
