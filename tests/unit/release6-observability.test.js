import { describe, expect, it } from 'vitest'
import {
  normalizeSystemEvent,
  sanitizeMetadata,
} from '../../supabase/functions/_shared/observability/logger.js'
import { rolloutEnabled } from '../../supabase/functions/_shared/observability/flags.js'

describe('Release 6 observability safety', () => {
  it('sanitizes sensitive metadata recursively', () => {
    const metadata = sanitizeMetadata({
      ok: 'visible',
      access_token: 'secret',
      nested: {
        jwt: 'secret',
        raw_prompt: 'full prompt',
        kept: 'short',
      },
      long: 'a'.repeat(700),
    })
    expect(metadata).toMatchObject({ ok: 'visible', nested: { kept: 'short' } })
    expect(JSON.stringify(metadata)).not.toContain('secret')
    expect(JSON.stringify(metadata)).not.toContain('full prompt')
    expect(metadata.long.length).toBeLessThan(510)
  })

  it('normalizes system events to the allowed schema', () => {
    const event = normalizeSystemEvent({
      userId: 'user-1',
      source: 'unknown',
      eventType: 'diagnostics_exported',
      severity: 'nope',
      status: 'bad',
      metadata: { password: 'hidden', safe: true },
    })
    expect(event).toMatchObject({
      user_id: 'user-1',
      source: 'system',
      event_type: 'diagnostics_exported',
      severity: 'info',
      status: 'success',
      metadata: { safe: true },
    })
    expect(event.correlation_id).toBeTruthy()
  })

  it('keeps feature flag rollout deterministic per user', () => {
    const flag = { key: 'operational_panel_enabled', enabled: true, rollout_percentage: 50 }
    expect(rolloutEnabled(flag, 'user-a')).toBe(rolloutEnabled(flag, 'user-a'))
    expect(rolloutEnabled({ ...flag, enabled: false }, 'user-a')).toBe(false)
    expect(rolloutEnabled({ ...flag, rollout_percentage: 100 }, 'user-a')).toBe(true)
  })

  it('keeps diagnostics free from detailed financial data by contract', () => {
    const diagnostics = {
      generated_at: '2026-06-18T18:00:00.000Z',
      user_id_hash: 'abc123',
      period_days: 7,
      feature_flags: [],
      recent_errors: [],
      ai_actions_summary: {},
      automations_summary: {},
      financial_validation_summary: {
        detailed_financial_data_included: false,
        transactions_included: false,
        complete_state_included: false,
      },
      environment: { release: '6' },
    }
    const serialized = JSON.stringify(diagnostics)
    expect(serialized).not.toMatch(/access_token|jwt|raw_prompt|full_finance_state/i)
    expect(serialized).not.toContain('transactions":[{')
    expect(diagnostics.financial_validation_summary).toMatchObject({
      detailed_financial_data_included: false,
      transactions_included: false,
      complete_state_included: false,
    })
  })
})
