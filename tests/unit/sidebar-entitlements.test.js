import { describe, expect, it } from 'vitest'
import { NAV_GROUPS } from '@/router/navigation.js'
import { canSeeNavItem, resolveFrontendAccess } from '@/domain/access-control.js'
import { isNavItemLocked } from '@/domain/entitlements/featureAccess.js'

describe('sidebar entitlements', () => {
  it('keeps the lean menu visible while locking premium consultor for Free users', () => {
    const access = resolveFrontendAccess({
      entitlements: {
        plan_code: 'free',
        features: { scenario_simulation: false, smart_actions: false, predictive_advisor: false, automations: true },
        limits: { price_search_monthly: 3, wishlist_items: 5, automations_active: 1 },
      },
    })
    const items = NAV_GROUPS.flatMap((group) => group.items)

    expect(items.find((item) => item.path === '/simulations')).toBeUndefined()
    expect(items.find((item) => item.path === '/ai-actions')).toBeUndefined()
    expect(items.find((item) => item.path === '/automations')).toBeUndefined()
    expect(isNavItemLocked(items.find((item) => item.path === '/advisor'), access)).toBe(true)
    expect(isNavItemLocked(items.find((item) => item.path === '/purchases'), access)).toBe(false)
  })

  it('keeps admin utilities available only for administrative accounts', () => {
    const items = NAV_GROUPS.flatMap((group) => group.items)
    const adminItem = items.find((item) => item.path === '/admin')
    const operationalItem = items.find((item) => item.path === '/operational')
    const common = resolveFrontendAccess({ admin: { is_admin: false, role: 'user' } })
    const support = resolveFrontendAccess({ admin: { is_admin: true, role: 'support' } })
    const owner = resolveFrontendAccess({ admin: { is_admin: true, role: 'owner' } })

    expect(canSeeNavItem(adminItem, common)).toBe(false)
    expect(canSeeNavItem(adminItem, support)).toBe(true)
    expect(canSeeNavItem(operationalItem, support)).toBe(false)
    expect(canSeeNavItem(operationalItem, owner)).toBe(true)
  })
})
