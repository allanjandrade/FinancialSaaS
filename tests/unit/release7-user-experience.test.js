import assert from 'node:assert/strict'
import fs from 'node:fs'
import { describe, it } from 'vitest'
import {
  buildDemoFinanceState,
  buildExecutiveSummary,
  getFirstStepsStatus,
  getInitialSetupStatus,
  RISK_LABELS,
} from '../../src/utils/release7-ux.js'

describe('Release 7 user experience', () => {
  it('calcula progresso do onboarding', () => {
    const empty = getInitialSetupStatus({
      settings: { year: 2026, selectedMonth: 6 },
      incomes: [],
      expenses: [],
      financialAccounts: [],
      creditCards: [],
      benefitWallets: [],
    }, () => ({}))
    assert.equal(empty.percent, 0)

    const complete = getInitialSetupStatus({
      settings: { year: 2026, selectedMonth: 6 },
      incomes: [{ amount: 3000 }],
      expenses: [{ amount: 120 }],
      financialAccounts: [{ balance: 100 }],
      creditCards: [],
      benefitWallets: [],
    }, () => ({}))
    assert.equal(complete.percent, 100)
    assert.equal(complete.complete, true)
  })

  it('considera onboarding concluido como setup suficiente sem exigir despesa ficticia', () => {
    const status = getInitialSetupStatus({
      settings: { year: 2026, selectedMonth: 7, onboardingCompletedAt: '2026-07-09T12:00:00.000Z' },
      incomes: [{ amount: 3000 }],
      expenses: [],
      recurringRules: [],
      financialAccounts: [{ balance: 0 }],
      creditCards: [],
      benefitWallets: [],
    }, () => ({}))

    assert.equal(status.complete, true)
    assert.equal(status.checks.find((item) => item.key === 'hasEntryOrPlannedExpense').complete, true)
  })

  it('mantem o onboarding focado em poucas decisoes visiveis', () => {
    const onboarding = fs.readFileSync('src/views/Onboarding.vue', 'utf8')
    const completion = fs.readFileSync('src/components/onboarding/OnboardingCompletion.vue', 'utf8')

    assert.match(onboarding, /data-testid="onboarding-focus-path"/)
    assert.match(onboarding, /Uma decis[aã]o por vez/)
    assert.match(onboarding, /<details class="optional-section"/)
    assert.match(onboarding, /:total="4"/)
    assert.match(onboarding, /sampleExpense: 0/)
    assert.doesNotMatch(onboarding, /sampleExpense: 120/)
    assert.doesNotMatch(completion, /Ativar alertas recomendados/)
  })

  it('mantem modo primeiros passos com quatro secoes ate receita e despesa existirem', () => {
    const partial = getFirstStepsStatus({
      settings: { year: 2026, selectedMonth: 7, onboardingCompletedAt: '2026-07-09T12:00:00.000Z' },
      incomes: [{ amount: 3000 }],
      expenses: [],
      recurringRules: [],
      subscriptions: [],
      planningGoals: [],
    })

    assert.deepEqual(partial.sections.map((section) => section.key), ['income', 'expense', 'goals', 'summary'])
    assert.deepEqual(partial.sections.map((section) => section.label), ['Receita', 'Despesa', 'Metas', 'Resumo'])
    assert.equal(partial.complete, false)

    const complete = getFirstStepsStatus({
      settings: { year: 2026, selectedMonth: 7, onboardingCompletedAt: '2026-07-09T12:00:00.000Z' },
      incomes: [{ amount: 3000 }],
      expenses: [{ amount: 120 }],
      recurringRules: [],
      subscriptions: [],
      planningGoals: [],
    })

    assert.equal(complete.complete, true)
    assert.equal(complete.sections.find((section) => section.key === 'goals').complete, false)
  })

  it('expõe visualizacao de primeiros passos sem os blocos cheios do dashboard completo', () => {
    const home = fs.readFileSync('src/views/Home.vue', 'utf8')

    assert.match(home, /data-testid="first-steps-mode"/)
    assert.match(home, /data-testid="first-steps-sections"/)
    assert.match(home, /data-first-step-section="income"/)
    assert.match(home, /data-first-step-section="expense"/)
    assert.match(home, /data-first-step-section="goals"/)
    assert.match(home, /data-first-step-section="summary"/)
    assert.match(home, /showFirstStepsMode/)
  })

  it('mantem VA/VR fora do patrimonio liquido validado', () => {
    const state = buildDemoFinanceState()
    const summary = buildExecutiveSummary(state, () => ({
      incomeCash: 6200,
      vaIncome: 900,
      cashExpenses: 1800,
      cardBill: 2880,
      cashBalance: 4400,
    }))
    assert.equal(summary.patrimony.netPatrimony, 4240 + 8600 + 8200)
    assert.equal(summary.patrimony.netPatrimony.toString().includes('640'), false)
  })

  it('demo mode nao muta estado financeiro em memoria', () => {
    const state = buildDemoFinanceState()
    const before = JSON.stringify(state)
    buildExecutiveSummary(state, () => ({ incomeCash: 1, vaIncome: 0, cashExpenses: 0, cardBill: 0 }))
    assert.equal(JSON.stringify(state), before)
  })

  it('padroniza labels de risco para linguagem de produto', () => {
    assert.deepEqual(RISK_LABELS, {
      normal: 'Tudo certo',
      attention: 'Atenção',
      risk: 'Risco',
      critical: 'Crítico',
    })
  })

  it('não sugere gasto seguro alto sem receita ou saldo real', () => {
    const summary = buildExecutiveSummary({
      settings: { year: 2026, selectedMonth: 7 },
      incomes: [],
      expenses: [],
      financialAccounts: [{ id: 'acc-empty', balance: 0 }],
      creditCards: [{ id: 'card-empty', limit: 5000, availableLimit: 5000 }],
      benefitWallets: [],
      priceMonitorAlerts: [],
    }, () => ({
      incomeCash: 0,
      vaIncome: 0,
      cashExpenses: 0,
      cardBill: 0,
    }))

    assert.equal(summary.safeToSpend, 0)
    assert.equal(summary.needsIncomeSetup, true)
    assert.equal(summary.nextAction, 'Cadastrar receita mensal')
    assert.equal(summary.mainRisk, 'Cadastre sua primeira receita para calcularmos sua capacidade segura de gastos.')
  })
})
