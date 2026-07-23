import fs from 'node:fs'
import { describe, expect, it } from 'vitest'

const read = (file) => fs.readFileSync(file, 'utf8')

describe('V3.3 proactive command center UI', () => {
  it('renders next best action and financial agenda from the proactive orchestrator', () => {
    const commandCenter = read('src/views/CommandCenter.vue')

    expect(commandCenter).toContain("import { buildProactiveFinancialAgenda } from '@/domain/v3/proactiveOrchestrator.js'")
    expect(commandCenter).toContain("import NextBestAction from '@/components/v3/NextBestAction.vue'")
    expect(commandCenter).toContain("import FinancialAgenda from '@/components/v3/FinancialAgenda.vue'")
    expect(commandCenter).toContain('const proactiveAgenda = computed(() => buildProactiveFinancialAgenda')
    expect(commandCenter).toContain('<NextBestAction')
    expect(commandCenter).toContain('<FinancialAgenda')
  })

  it('keeps the agenda visual as a list instead of another card grid', () => {
    const agenda = read('src/components/v3/FinancialAgenda.vue')
    const nextAction = read('src/components/v3/NextBestAction.vue')

    expect(agenda).toContain('data-testid="v33-financial-agenda"')
    expect(agenda).toContain('v33-agenda-list')
    expect(agenda).toContain('v33-agenda-item')
    expect(agenda).not.toContain('grid-template-columns: repeat(3')

    expect(nextAction).toContain('data-testid="v33-next-best-action"')
    expect(nextAction).toContain('emit(')
    expect(nextAction).toContain('blockers')
  })
})
