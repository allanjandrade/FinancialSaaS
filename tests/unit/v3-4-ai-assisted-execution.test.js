import fs from 'node:fs'
import { describe, expect, it } from 'vitest'
import { buildAssistedExecution, executionFactsForAI } from '@/domain/v3/actionExecution.js'

const read = (file) => fs.readFileSync(file, 'utf8')

describe('V3.4 assisted execution AI integration', () => {
  it('sends assisted execution facts through the financial analyst API', () => {
    const analyst = read('src/api/financial-analyst.js')
    const intelligence = read('src/views/IntelligenceCenter.vue')

    expect(analyst).toContain("import { executionFactsForAI } from '@/domain/v3/actionExecution.js'")
    expect(analyst).toContain('assistedExecution = null')
    expect(analyst).toContain('v34Execution: assistedExecution ? executionFactsForAI(assistedExecution) : null')

    expect(intelligence).toContain("import { buildAssistedExecution } from '@/domain/v3/actionExecution.js'")
    expect(intelligence).toContain('const assistedExecution = computed(() => buildAssistedExecution')
    expect(intelligence).toContain('assistedExecution: assistedExecution.value')
  })

  it('exposes explanatory execution facts without mutation authority', () => {
    const execution = buildAssistedExecution(
      {
        key: 'first-income',
        executionType: 'first-income',
        title: 'Cadastrar primeira receita',
        description: 'Cadastre uma renda real para liberar diagnosticos confiaveis.',
        route: '/entries',
      },
      {
        state: {
          financialAccounts: [{ id: 'account-1' }],
        },
        subscriptionSummary: {},
        referenceDate: '2026-07-23',
      },
    )

    const facts = executionFactsForAI(execution)
    const jsonFacts = JSON.stringify(facts)

    expect(facts.canWrite).toBe(false)
    expect(jsonFacts).not.toContain('addIncome')
    expect(jsonFacts).not.toContain('pauseSubscription')
    expect(jsonFacts).not.toContain('cancelSubscription')
    expect(jsonFacts).not.toContain('updateSubscription')
    expect(jsonFacts).not.toContain('writeHandler')
    expect(jsonFacts).not.toContain('confirmMutation')
    expect(jsonFacts).not.toContain('function')
  })
})
