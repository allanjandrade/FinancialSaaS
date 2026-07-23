import { describe, expect, it } from 'vitest'
import { projectMonthEnd } from '@/domain/predictive/index.js'
import { predictiveState } from './predictive-fixture.js'

describe('Release 9 predictive month-end projection', () => {
  it('calculates deterministic projected closing for the selected month', () => {
    const projection = projectMonthEnd(predictiveState(), '2026-06-15')

    expect(projection.confirmedIncome).toBe(5000)
    expect(projection.projectedExpenses).toBeGreaterThan(projection.confirmedExpenses)
    expect(projection.projectedBalance).toBeLessThan(5000)
    expect(projection.confidence).toBeGreaterThan(0)
  })
})
