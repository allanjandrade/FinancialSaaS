import { describe, expect, it } from 'vitest'
import { buildAdvisorReport } from '@/domain/predictive/index.js'
import { predictiveState } from './predictive-fixture.js'

describe('Release 9 predictive recommendation engine', () => {
  it('recommends cuts only from deterministic overrun risks', () => {
    const report = buildAdvisorReport(predictiveState(), '2026-06-15')

    expect(report.source).toBe('deterministic')
    expect(report.aiMayExplainOnly).toBe(true)
    expect(report.snapshot.overrunRisks.map((risk) => risk.category)).toContain(report.recommendations[0].category)
    expect(report.recommendations[0].suggestedCut).toBeGreaterThan(0)
  })

  it('uses user-facing scenario and risk labels in the narrative', () => {
    const report = buildAdvisorReport(predictiveState(), '2026-06-15')
    const narrative = report.narrative.join(' ')

    expect(narrative).toContain('Cenário provável')
    expect(narrative).not.toMatch(/\bstable\b|\battention\b|\bcritical\b/)
  })
})
