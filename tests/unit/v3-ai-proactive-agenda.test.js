import fs from 'node:fs'
import { describe, expect, it } from 'vitest'
import { buildProactiveFinancialAgenda, v33AgendaFactsForAI } from '@/domain/v3/proactiveOrchestrator.js'

const read = (file) => fs.readFileSync(file, 'utf8')

describe('V3.3 proactive agenda AI integration', () => {
  it('sends proactive agenda facts through the financial analyst API', () => {
    const analyst = read('src/api/financial-analyst.js')
    const intelligence = read('src/views/IntelligenceCenter.vue')

    expect(analyst).toContain("import { v33AgendaFactsForAI } from '@/domain/v3/proactiveOrchestrator.js'")
    expect(analyst).toContain('proactiveAgenda = null')
    expect(analyst).toContain('v33Agenda: proactiveAgenda ? v33AgendaFactsForAI(proactiveAgenda) : null')

    expect(intelligence).toContain("import { buildProactiveFinancialAgenda } from '@/domain/v3/proactiveOrchestrator.js'")
    expect(intelligence).toContain('const proactiveAgenda = computed(() => buildProactiveFinancialAgenda')
    expect(intelligence).toContain('proactiveAgenda: proactiveAgenda.value')
  })

  it('keeps agenda facts compact and grounded in real agenda items', () => {
    const agenda = buildProactiveFinancialAgenda({
      state: {
        incomes: [{ amount: 5000, date: '2026-07-01' }],
        expenses: [],
        subscriptions: [{
          id: 'sub-1',
          name: 'Netflix',
          amount: 39.9,
          billing_cycle: 'monthly',
          next_billing_date: '2026-07-25',
          status: 'active',
          is_essential: false,
        }],
      },
      monthData: { incomeCash: 5000, cashExpenses: 1000, cardBill: 500, cashBalance: 3500 },
      subscriptionSummary: {
        totalMonthly: 39.9,
        dispensableMonthly: 39.9,
        next7Days: [{
          id: 'sub-1',
          name: 'Netflix',
          amount: 39.9,
          next_billing_date: '2026-07-25',
          daysUntil: 2,
        }],
        next30Days: [],
        alerts: [],
      },
      commandCenter: { mode: 'optimize' },
      referenceDate: '2026-07-23',
    })
    const facts = v33AgendaFactsForAI(agenda)

    expect(facts.nextBestAction.title).toBeTruthy()
    expect(facts.items.some((item) => item.route === '/subscriptions')).toBe(true)
    expect(facts.impact.avoidableMonthly).toBe(39.9)
  })
})
