import { describe, expect, it } from 'vitest'
import { calculateSafeInvestmentCapacity } from '@/domain/predictive/index.js'
import { predictiveState } from './predictive-fixture.js'

describe('Release 9 predictive investment capacity', () => {
  it('preserves reserve and goals before suggesting investment capacity', () => {
    const capacity = calculateSafeInvestmentCapacity(predictiveState(), '2026-06-15')

    expect(capacity.reserveTarget).toBe(1000)
    expect(capacity.goalCommitment).toBe(500)
    expect(capacity.safeCapacity).toBeGreaterThanOrEqual(0)
    expect(capacity.safeCapacity).toBeLessThanOrEqual(capacity.maximumCapacity)
  })
})
