import { describe, expect, it } from 'vitest'
import { resolveFrontendAccess } from '@/domain/access-control.js'

describe('Release 11 production entitlements', () => {
  it('separates tester, free and premium account states', () => {
    expect(resolveFrontendAccess({ entitlements: { plan_code: 'free', is_tester: false } }).isPremium).toBe(false)
    expect(resolveFrontendAccess({ entitlements: { plan_code: 'free', is_tester: true } }).isTester).toBe(true)
    expect(resolveFrontendAccess({ entitlements: { plan_code: 'premium_monthly', is_tester: false } }).isPremium).toBe(true)
  })
})
