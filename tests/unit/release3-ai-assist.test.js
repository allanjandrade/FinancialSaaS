import { describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { validateAiAssistPayload } from '../../supabase/functions/_shared/ai/payload.js'
import { runAiAssistFlow } from '../../supabase/functions/_shared/ai/orchestrator.js'
import { sanitizeAiResponse } from '../../supabase/functions/_shared/ai/response.js'

function dependencies(overrides = {}) {
  return {
    requireConsent: vi.fn().mockResolvedValue(true),
    reserveQuota: vi.fn().mockResolvedValue({ usage_date: '2026-06-12' }),
    buildContext: vi.fn().mockResolvedValue({ context: { snapshot: { monthlyIncome: 3000 } }, basis: ['motor'], warnings: [], familyId: 'family-1' }),
    generate: vi.fn().mockResolvedValue({
      data: { answer: 'Analise segura.', confidence: 'high', basis: ['motor'], warnings: [], suggested_questions: [], suggested_actions: [] },
      usage: { inputTokens: 10, outputTokens: 20 },
    }),
    finalizeQuota: vi.fn().mockResolvedValue(true),
    log: vi.fn().mockResolvedValue(true),
    ...overrides,
  }
}

describe('Release 3 contextual read-only assistant', () => {
  it('accepts only the documented frontend payload', () => {
    expect(validateAiAssistPayload({ context_type: 'dashboard', entity_id: null, user_query: 'Como estou?' })).toEqual({
      contextType: 'dashboard', entityId: null, userQuery: 'Como estou?',
    })
    expect(() => validateAiAssistPayload({ context_type: 'dashboard', user_query: 'Como estou?', user_id: 'forged' })).toThrow(/Campo nao permitido/)
    expect(() => validateAiAssistPayload({ context_type: 'dashboard', user_query: 'Como estou?', context_payload: {} })).toThrow(/Campo nao permitido/)
  })

  it('checks consent before reserving quota or calling Gemini', async () => {
    const deps = dependencies({ requireConsent: vi.fn().mockRejectedValue(new Error('CONSENT_REQUIRED')) })
    await expect(runAiAssistFlow({ context_type: 'dashboard', entity_id: null, user_query: 'Analise' }, deps)).rejects.toThrow('CONSENT_REQUIRED')
    expect(deps.reserveQuota).not.toHaveBeenCalled()
    expect(deps.generate).not.toHaveBeenCalled()
  })

  it('checks quota before building context or calling Gemini', async () => {
    const deps = dependencies({ reserveQuota: vi.fn().mockRejectedValue(new Error('LIMIT')) })
    await expect(runAiAssistFlow({ context_type: 'entries', entity_id: null, user_query: 'Analise' }, deps)).rejects.toThrow('LIMIT')
    expect(deps.buildContext).not.toHaveBeenCalled()
    expect(deps.generate).not.toHaveBeenCalled()
  })

  it('forces every suggested action to be non executable', () => {
    const result = sanitizeAiResponse({
      answer: 'Revise o relatorio.', confidence: 'medium', basis: [], warnings: [], suggested_questions: [],
      suggested_actions: [{ label: 'Transferir agora', executable: true }, 'Revisar categorias'],
    })
    expect(result.suggested_actions).toEqual([
      { label: 'Transferir agora', executable: false },
      { label: 'Revisar categorias', executable: false },
    ])
  })

  it('returns a safe low-confidence fallback for malformed model output', () => {
    expect(sanitizeAiResponse(null, ['snapshot'], ['dados insuficientes'])).toMatchObject({ confidence: 'low', basis: ['snapshot'], suggested_actions: [] })
  })

  it('preserves the required execution order and minimized logging', async () => {
    const calls = []
    const deps = dependencies()
    for (const name of ['requireConsent', 'reserveQuota', 'buildContext', 'generate', 'finalizeQuota', 'log']) {
      const original = deps[name]
      deps[name] = vi.fn(async (...args) => { calls.push(name); return original(...args) })
    }
    await runAiAssistFlow({ context_type: 'reports', entity_id: null, user_query: 'Quais mudancas?' }, deps)
    expect(calls).toEqual(['requireConsent', 'reserveQuota', 'buildContext', 'generate', 'finalizeQuota', 'log'])
    expect(deps.log.mock.calls[0][0]).not.toHaveProperty('contextPayload')
  })

  it('does not discard a valid answer when minimized audit logging fails', async () => {
    const onLogError = vi.fn()
    const deps = dependencies({
      log: vi.fn().mockRejectedValue(new Error('audit unavailable')),
      onLogError,
    })
    const result = await runAiAssistFlow(
      { context_type: 'dashboard', entity_id: null, user_query: 'Analise' },
      deps,
    )
    expect(result.answer).toBe('Analise segura.')
    expect(onLogError).toHaveBeenCalledOnce()
  })

  it('keeps the Edge Function authenticated and free of financial writes', () => {
    const source = readFileSync(resolve('supabase/functions/ai-assist/index.ts'), 'utf8')
    expect(source).toContain('requireAuthenticatedUser')
    expect(source).toContain('runAiAssistFlow')
    expect(source).not.toMatch(/from\(['"](?:finance_states|expenses|incomes|purchase_items)['"]\).*\.(?:insert|update|delete|upsert)/s)
  })
})
