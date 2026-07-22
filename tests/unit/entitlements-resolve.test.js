import { describe, expect, it } from 'vitest'
import { resolveEntitlements } from '@/domain/billing/entitlements.js'

describe('Release 10 entitlements resolve', () => {
  it('combines plan, active tester and expiring overrides', () => {
    const resolved = resolveEntitlements({
      subscription: { status: 'free', plan_code: 'free' },
      tester: { status: 'active', tester_group: 'release10', access_expires_at: '2026-07-20T00:00:00Z' },
      overrides: [
        { feature_key: 'predictive_advisor', enabled: false, expires_at: '2026-07-01T00:00:00Z' },
        { feature_key: 'automations', enabled: false, expires_at: '2026-06-01T00:00:00Z' },
      ],
    }, new Date('2026-06-20T00:00:00Z'))

    expect(resolved.is_tester).toBe(true)
    expect(resolved.features.predictive_advisor).toBe(false)
    expect(resolved.features.automations).toBe(true)
  })

  it('expires tester access', () => {
    const resolved = resolveEntitlements({
      tester: { status: 'active', access_expires_at: '2026-06-01T00:00:00Z' },
    }, new Date('2026-06-20T00:00:00Z'))

    expect(resolved.is_tester).toBe(false)
    expect(resolved.features.predictive_advisor).toBe(false)
  })
})
