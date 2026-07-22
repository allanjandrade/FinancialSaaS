import { describe, expect, it } from 'vitest'
import { buildPredictiveSnapshot, simulateScenario } from '@/domain/predictive/index.js'
import { predictiveState } from './predictive-fixture.js'

describe('Release 9 predictive scenario engine', () => {
  it('builds conservative, probable and critical scenarios deterministically', () => {
    const snapshot = buildPredictiveSnapshot(predictiveState(), '2026-06-15')
    const critical = simulateScenario(predictiveState(), 'critical', '2026-06-15')

    expect(snapshot.scenarios.map((item) => item.scenario)).toEqual(['conservative', 'probable', 'critical'])
    expect(critical.projectedExpenses).toBeGreaterThan(snapshot.projection.projectedExpenses)
    expect(critical.projectedIncome).toBeLessThan(snapshot.projection.confirmedIncome)
  })
})
