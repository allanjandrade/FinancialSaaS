import { describe, expect, it } from 'vitest'
import { buildAdvisorReport } from '@/domain/predictive/index.js'
import { predictiveState } from './predictive-fixture.js'

describe('Release 9 advisor deterministic context', () => {
  it('marks prohibited financial shortcuts as disabled', () => {
    const report = buildAdvisorReport(predictiveState(), '2026-06-15')

    expect(report.snapshot.forbiddenActions.automaticFinancialWrite).toBe(false)
    expect(report.snapshot.forbiddenActions.aiGeneratedNumbers).toBe(false)
    expect(report.snapshot.forbiddenActions.cardLimitAsCash).toBe(false)
    expect(report.snapshot.forbiddenActions.benefitsAsNetWorth).toBe(false)
  })
})
