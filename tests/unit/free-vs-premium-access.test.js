import { describe, expect, it } from 'vitest'
import { resolveFrontendAccess } from '@/domain/access-control.js'
import { resolveEntitlements } from '@/domain/billing/entitlements.js'
import { getPlan } from '@/domain/billing/plans.js'
import { featureForPath, hasFeatureAccess } from '@/domain/entitlements/featureAccess.js'

describe('Release 11.2 Free vs Premium access', () => {
  it('keeps Free useful but blocks premium-only intelligence and exports', () => {
    const free = getPlan('free')

    expect(free.features.price_search).toBe(true)
    expect(free.features.wishlist_items).toBe(true)
    expect(free.features.automations).toBe(true)
    expect(free.limits.price_search_monthly).toBe(3)
    expect(free.limits.wishlist_items).toBe(5)
    expect(free.limits.automations_active).toBe(1)

    for (const feature of ['predictive_advisor', 'advanced_reports', 'scenario_simulation', 'smart_actions', 'export_reports', 'advanced_price_history']) {
      expect(free.features[feature]).toBe(false)
    }
  })

  it('maps premium routes to locked features and unlocks them for Premium', () => {
    const freeAccess = resolveFrontendAccess({ entitlements: resolveEntitlements({ subscription: { status: 'free', plan_code: 'free' } }) })
    const premiumAccess = resolveFrontendAccess({ entitlements: resolveEntitlements({ subscription: { status: 'active', plan_code: 'premium_monthly' } }) })

    expect(featureForPath('/advisor')).toBe('predictive_advisor')
    expect(featureForPath('/simulations/can-i-buy')).toBe('scenario_simulation')
    expect(featureForPath('/ai-actions')).toBe('smart_actions')
    expect(hasFeatureAccess(freeAccess, 'predictive_advisor')).toBe(false)
    expect(hasFeatureAccess(premiumAccess, 'predictive_advisor')).toBe(true)
  })
})
