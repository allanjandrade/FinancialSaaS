import fs from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('advisor view contract', () => {
  it('does not expose raw technical scenario risk values', () => {
    const source = fs.readFileSync('src/views/Advisor.vue', 'utf8')

    expect(source).toContain('scenarioRiskLabel(item.risk)')
    expect(source).not.toContain('<small>{{ item.risk }}</small>')
    expect(source).toContain("stable: ''")
    expect(source).toContain("attention: 'Atenção'")
    expect(source).toContain("critical: 'Crítico'")
  })
})
