import fs from 'node:fs'
import { describe, expect, it } from 'vitest'
import router from '@/router/index.js'
import { NAV_GROUPS } from '@/router/navigation.js'

describe('AI actions architecture', () => {
  it('keeps AI actions as a route-level proposal hub instead of a main menu item', () => {
    const labels = NAV_GROUPS.flatMap((group) => group.items.map((item) => item.label))
    const aiHub = fs.readFileSync('src/views/AIActionHub.vue', 'utf8')

    expect(labels).not.toContain('Ações inteligentes')
    expect(labels).not.toContain('Histórico de ações')
    expect(router.resolve('/ai-actions').matched.length).toBeGreaterThan(0)
    expect(aiHub).toContain('data-testid="ai-action-history"')
    expect(aiHub).toContain('listAiActionHistory')
    expect(aiHub).not.toContain("to: '/ai-actions?tab=history#historico'")
  })
})
