import { describe, expect, it } from 'vitest'
import { summarizeCypressResult } from '../../scripts/cypress-result.js'

describe('Cypress result summary', () => {
  it('reports success only when all specs completed without errors', () => {
    expect(summarizeCypressResult({
      totalPassed: 16,
      totalTests: 16,
      totalFailed: 0,
      runs: [{ error: null, stats: { failures: 0 } }],
    })).toMatchObject({ failed: 0, passed: 16, total: 16 })
  })

  it('reports a spec compilation error even when totalFailed is zero', () => {
    const result = summarizeCypressResult({
      totalPassed: 10,
      totalTests: 10,
      totalFailed: 0,
      runs: [
        { error: null, stats: { failures: 0 } },
        { error: 'Webpack Compilation Error', stats: { failures: 1 } },
      ],
    })
    expect(result).toMatchObject({ failed: 1, passed: 10, total: 10 })
    expect(result.messages).toContain('Webpack Compilation Error')
  })
})
