import { describe, expect, it } from 'vitest'
import { canUseFeature, resolveEntitlements } from '@/domain/billing/entitlements.js'

describe('Release 10 billing entitlements', () => {
  it('keeps free limited and premium unlocked', () => {
    const free = resolveEntitlements({ subscription: { status: 'free', plan_code: 'free' } })
    const premium = resolveEntitlements({ subscription: { status: 'active', plan_code: 'premium_monthly' } })

    expect(free.features.predictive_advisor).toBe(false)
    expect(free.limits.price_search_monthly).toBe(3)
    expect(premium.features.predictive_advisor).toBe(true)
    expect(canUseFeature(free, 'price_search', 3).reason).toBe('LIMIT_EXCEEDED')
  })

  it('removes premium after cancellation and allows past_due grace', () => {
    const canceled = resolveEntitlements({ subscription: { status: 'canceled', plan_code: 'premium_monthly' } })
    const pastDue = resolveEntitlements({
      subscription: { status: 'past_due', plan_code: 'premium_monthly', current_period_end: '2026-06-19T00:00:00Z' },
    }, new Date('2026-06-20T00:00:00Z'))

    expect(canceled.plan_code).toBe('free')
    expect(canceled.features.predictive_advisor).toBe(false)
    expect(pastDue.features.predictive_advisor).toBe(true)
  })
})
