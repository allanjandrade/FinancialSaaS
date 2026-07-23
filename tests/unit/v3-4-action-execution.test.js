import { describe, expect, it } from 'vitest'
import { buildProactiveFinancialAgenda } from '@/domain/v3/proactiveOrchestrator.js'
import {
  buildAssistedExecution,
  buildExecutionConfirmation,
  executionFactsForAI,
} from '@/domain/v3/actionExecution.js'

const referenceDate = '2026-07-23'

function subscription(overrides = {}) {
  return {
    id: 'sub-netflix',
    name: 'Netflix',
    provider: 'Netflix',
    category: 'Streaming',
    amount: 39.9,
    billing_cycle: 'monthly',
    next_billing_date: '2026-07-25',
    status: 'active',
    is_essential: false,
    url: 'https://www.netflix.com/cancelplan',
    ...overrides,
  }
}

function collectObjectValues(value) {
  if (Array.isArray(value)) {
    return value.flatMap((item) => collectObjectValues(item))
  }

  if (value && typeof value === 'object') {
    return Object.values(value).flatMap((item) => collectObjectValues(item))
  }

  return [value]
}

function collectObjectKeys(value) {
  if (Array.isArray(value)) {
    return value.flatMap((item) => collectObjectKeys(item))
  }

  if (value && typeof value === 'object') {
    return [
      ...Object.keys(value),
      ...Object.values(value).flatMap((item) => collectObjectKeys(item)),
    ]
  }

  return []
}

describe('V3.4 assisted execution domain', () => {
  it('adds execution metadata to proactive agenda items without breaking route fields', () => {
    const agenda = buildProactiveFinancialAgenda({
      state: { incomes: [], expenses: [], planningGoals: [], subscriptions: [] },
      monthData: { incomeCash: 0, cashExpenses: 0, cardBill: 0, cashBalance: 0 },
      subscriptionSummary: { totalMonthly: 0, next7Days: [], next30Days: [], alerts: [] },
      commandCenter: { mode: 'setup' },
      referenceDate,
    })

    expect(agenda.nextBestAction).toMatchObject({
      key: 'first-income',
      route: '/entries',
      executionType: 'first-income',
      executionMode: 'drawer',
      requiresConfirmation: true,
      contextKey: 'income',
    })
  })

  it('maps first income into a drawer execution with a confirmation summary', () => {
    const item = {
      key: 'first-income',
      type: 'setup',
      title: 'Cadastre sua primeira receita',
      description: 'Sem renda real, a agenda bloqueia capacidade de gasto.',
      route: '/entries',
      actionLabel: 'Cadastrar receita',
      priority: 'critical',
      executionType: 'first-income',
      executionMode: 'drawer',
      requiresConfirmation: true,
      contextKey: 'income',
    }

    const execution = buildAssistedExecution(item, {
      state: { financialAccounts: [{ id: 'acc-1', name: 'Conta principal' }] },
      referenceDate,
    })

    expect(execution).toMatchObject({
      type: 'first-income',
      mode: 'drawer',
      canWrite: true,
      requiresConfirmation: true,
      route: '/entries',
      actionLabel: 'Confirmar receita',
    })
    expect(execution.draftDefaults).toMatchObject({
      description: 'Receita mensal',
      amount: 0,
      date: referenceDate,
      sourceId: 'acc-1',
    })

    const confirmation = buildExecutionConfirmation(execution, {
      description: 'Salario',
      amount: 5000,
      date: referenceDate,
      sourceId: 'acc-1',
    })

    expect(confirmation).toMatchObject({
      title: 'Confirmar receita',
      confirmLabel: 'Salvar receita',
      destructive: false,
    })
    expect(confirmation.message).toContain('Salario')
    expect(confirmation.message.replace(/\s/g, ' ')).toContain('R$ 5.000,00')
  })

  it('maps upcoming subscription charges to safe subscription actions', () => {
    const agenda = buildProactiveFinancialAgenda({
      state: {
        incomes: [{ amount: 5000 }],
        expenses: [],
        planningGoals: [],
        subscriptions: [subscription()],
      },
      monthData: { incomeCash: 5000, cashExpenses: 1200, cardBill: 300, cashBalance: 3500 },
      subscriptionSummary: {
        totalMonthly: 39.9,
        dispensableMonthly: 39.9,
        next7Days: [{ ...subscription(), daysUntil: 2 }],
        next30Days: [],
        alerts: [],
      },
      commandCenter: { mode: 'optimize' },
      referenceDate,
    })

    const charge = agenda.items.find((item) => item.type === 'subscription-charge')
    expect(charge).toMatchObject({
      executionType: 'subscription-charge',
      executionMode: 'drawer',
      requiresConfirmation: true,
      contextKey: 'sub-netflix',
      subscriptionId: 'sub-netflix',
    })

    const execution = buildAssistedExecution(charge, {
      state: { subscriptions: [subscription()] },
      referenceDate,
    })

    expect(execution).toMatchObject({
      type: 'subscription-charge',
      mode: 'drawer',
      canWrite: true,
      route: '/subscriptions',
    })
    expect(execution.target).toMatchObject({ id: 'sub-netflix', name: 'Netflix' })
    expect(execution.draftDefaults).toMatchObject({ action: 'pause', nextBillingDate: '2026-07-25' })
    expect(execution.externalUrl).toBe('https://www.netflix.com/cancelplan')
  })

  it('keeps OCR review as a drawer explanation with route fallback and no write authority', () => {
    const item = {
      key: 'review-ocr-1',
      type: 'pending-review',
      title: 'Revise 1 lancamento reconhecido',
      description: 'OCR precisa de revisao.',
      route: '/entries',
      actionLabel: 'Revisar agora',
      priority: 'high',
      executionType: 'review-ocr',
      executionMode: 'drawer',
      requiresConfirmation: false,
      contextKey: 'ocr-1',
      impactAmount: 1,
    }

    const execution = buildAssistedExecution(item, { state: {}, referenceDate })

    expect(execution).toMatchObject({
      type: 'review-ocr',
      mode: 'drawer',
      canWrite: false,
      fallbackRoute: '/entries',
      actionLabel: 'Abrir revisao',
      requiresConfirmation: false,
    })
  })

  it('builds a subscription cut review with monthly and annual savings', () => {
    const item = {
      key: 'cut-dispensable-subscriptions',
      type: 'optimization',
      title: 'Corte assinaturas dispensaveis',
      description: 'Ha economia recorrente disponivel.',
      route: '/subscriptions',
      actionLabel: 'Revisar cortes',
      priority: 'medium',
      executionType: 'cut-dispensable-subscriptions',
      executionMode: 'drawer',
      requiresConfirmation: true,
      contextKey: 'subscriptions',
      impactAmount: 39.9,
      annualImpactAmount: 478.8,
    }

    const execution = buildAssistedExecution(item, {
      state: { subscriptions: [subscription(), subscription({ id: 'icloud', name: 'iCloud', amount: 14.9, is_essential: true })] },
      referenceDate,
    })

    expect(execution).toMatchObject({
      type: 'cut-dispensable-subscriptions',
      mode: 'drawer',
      canWrite: true,
      impactAmount: 39.9,
      annualImpactAmount: 478.8,
    })
    expect(execution.options).toHaveLength(1)
    expect(execution.options[0]).toMatchObject({ id: 'sub-netflix', name: 'Netflix', monthlyAmount: 39.9 })
  })

  it('exports compact execution facts for AI without mutation authority', () => {
    const execution = buildAssistedExecution({
      key: 'create-first-goal',
      type: 'planning',
      title: 'Crie uma meta norteadora',
      description: 'Uma meta transforma sobra em plano.',
      route: '/goals',
      actionLabel: 'Criar meta',
      priority: 'medium',
      executionType: 'create-first-goal',
      executionMode: 'drawer',
      requiresConfirmation: true,
      contextKey: 'goal',
    }, { state: {}, referenceDate })

    const facts = executionFactsForAI(execution)

    expect(facts).toEqual(expect.objectContaining({
      type: 'create-first-goal',
      mode: 'drawer',
      requiresConfirmation: true,
      canWrite: false,
      route: '/goals',
    }))
    expect(collectObjectValues(facts)).not.toEqual(expect.arrayContaining([undefined, null]))
    expect(collectObjectKeys(facts)).not.toEqual(expect.arrayContaining(['confirmMutation', 'writeHandler']))
  })
})
