import { describe, expect, it } from 'vitest'
import { canAccessCheckout, canSeeNavItem, resolveFrontendAccess } from '@/domain/access-control.js'

describe('Release 11 frontend access control', () => {
  it('never trusts cached local state to infer admin access', () => {
    const access = resolveFrontendAccess({
      admin: { is_admin: false, role: 'user' },
      entitlements: { plan_code: 'free', is_tester: false },
    })

    expect(canSeeNavItem({ path: '/admin', adminOnly: true }, access)).toBe(false)
    expect(canSeeNavItem({ path: '/operational', operationalOnly: true }, access)).toBe(false)
  })

  it('separates owner/admin/support from operational go-live access', () => {
    const owner = resolveFrontendAccess({ admin: { is_admin: true, role: 'owner' } })
    const admin = resolveFrontendAccess({ admin: { is_admin: true, role: 'admin' } })
    const support = resolveFrontendAccess({ admin: { is_admin: true, role: 'support' } })

    expect(canSeeNavItem({ adminOnly: true }, owner)).toBe(true)
    expect(canSeeNavItem({ adminOnly: true }, support)).toBe(true)
    expect(canSeeNavItem({ operationalOnly: true }, owner)).toBe(true)
    expect(canSeeNavItem({ operationalOnly: true }, admin)).toBe(true)
    expect(canSeeNavItem({ operationalOnly: true }, support)).toBe(false)
  })

  it('keeps billing checkout in testers_only during controlled go-live', () => {
    const common = resolveFrontendAccess({ entitlements: { plan_code: 'free', is_tester: false } })
    const tester = resolveFrontendAccess({ entitlements: { plan_code: 'free', is_tester: true } })
    const owner = resolveFrontendAccess({ admin: { is_admin: true, role: 'owner' }, entitlements: { plan_code: 'free' } })

    expect(canAccessCheckout(common, 'testers_only')).toBe(false)
    expect(canAccessCheckout(tester, 'testers_only')).toBe(true)
    expect(canAccessCheckout(owner, 'testers_only')).toBe(true)
    expect(canAccessCheckout(tester, 'disabled')).toBe(false)
  })
})
