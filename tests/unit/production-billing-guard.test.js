import { describe, expect, it } from 'vitest'
import { canAccessCheckout, resolveFrontendAccess } from '@/domain/access-control.js'
import { resolveBillingCheckoutMode } from '@/domain/production-go-live.js'

describe('Release 11 production billing guard', () => {
  it('starts checkout in controlled testers_only mode', () => {
    const common = resolveFrontendAccess({ entitlements: { plan_code: 'free', is_tester: false } })
    const tester = resolveFrontendAccess({ entitlements: { plan_code: 'free', is_tester: true } })

    expect(resolveBillingCheckoutMode()).toBe('testers_only')
    expect(canAccessCheckout(common, 'testers_only')).toBe(false)
    expect(canAccessCheckout(tester, 'testers_only')).toBe(true)
  })
})
