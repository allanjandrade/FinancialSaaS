import { describe, expect, it } from 'vitest'
import { publicPlans } from '@/domain/billing/plans.js'

describe('Release 11.2 pricing strategy', () => {
  it('publishes only Free, Premium monthly and Premium annual', () => {
    const plans = publicPlans()

    expect(plans.map((plan) => plan.code)).toEqual(['free', 'premium_monthly', 'premium_annual'])
    expect(plans[0].name).toBe('Grátis')
    expect(plans[1].monthlyPrice).toBe(19.9)
    expect(plans[2].monthlyPrice).toBe(16.58)
    expect(plans[2].annualPrice).toBe(199)
  })
})
