import { describe, expect, it } from 'vitest'
import { calculatePricingModel, getPlan, publicPlans } from '@/domain/billing/plans.js'

describe('Release 10 billing plans', () => {
  it('defines free and premium without hardcoding gateway secrets', () => {
    expect(getPlan('free').limits.entries_monthly).toBe(30)
    expect(getPlan('premium_monthly').features.predictive_advisor).toBe(true)
    expect(publicPlans().map((plan) => plan.code)).toEqual(['free', 'premium_monthly', 'premium_annual'])
  })

  it('calculates margin, LTV and max CAC', () => {
    const model = calculatePricingModel({ price: 19.9, variableCosts: 2.5 })
    expect(model.netRevenue).toBeGreaterThan(0)
    expect(model.marginPercent).toBeGreaterThan(50)
    expect(model.maxCac).toBeGreaterThan(0)
  })
})
