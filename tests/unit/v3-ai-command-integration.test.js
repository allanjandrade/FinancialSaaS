import { describe, expect, it } from 'vitest'
import fs from 'node:fs'

const read = (file) => fs.readFileSync(file, 'utf8')

describe('V3 command center AI integration', () => {
  it('sends command center facts to the consultative financial analyst', () => {
    const analyst = read('src/api/financial-analyst.js')
    const intelligence = read('src/views/IntelligenceCenter.vue')

    expect(analyst).toContain("import { v3CommandFactsForAI } from '@/domain/v3/commandCenter.js'")
    expect(analyst).toContain('commandCenter')
    expect(analyst).toContain('v3Command: commandCenter ? v3CommandFactsForAI(commandCenter) : null')

    expect(intelligence).toContain("import { buildV3CommandCenter } from '@/domain/v3/commandCenter.js'")
    expect(intelligence).toContain('const v3Command = computed(() => buildV3CommandCenter')
    expect(intelligence).toContain('commandCenter: v3Command.value')
  })
})
