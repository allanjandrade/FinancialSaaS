import { describe, expect, it } from 'vitest'
import { setFeatureOverride } from '@/domain/admin/feature-flags.js'

describe('Release 10 feature flags', () => {
  it('requires known feature and reason for overrides', () => {
    expect(setFeatureOverride({ user_id: 'u1', feature_key: 'predictive_advisor', enabled: true, reason: 'Tester Release 10' }).enabled).toBe(true)
    expect(() => setFeatureOverride({ user_id: 'u1', feature_key: 'unknown', enabled: true, reason: 'x' })).toThrow('feature inexistente')
    expect(() => setFeatureOverride({ user_id: 'u1', feature_key: 'predictive_advisor', enabled: true })).toThrow('reason obrigatorio')
  })
})
