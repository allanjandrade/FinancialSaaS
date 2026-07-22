import { describe, expect, it } from 'vitest'
import { calculatePricingModel } from '@/domain/billing/plans.js'

describe('Release 10 billing pricing model', () => {
  it('keeps the initial premium price viable above the minimum launch price', () => {
    const model = calculatePricingModel({ price: 19.9, monthlyFixedCosts: 500 })

    expect(model.grossRevenue).toBeGreaterThanOrEqual(14.9)
    expect(model.breakEvenSubscribers).toBeGreaterThan(0)
    expect(model.arrAt100Subscribers).toBe(23880)
  })
})
