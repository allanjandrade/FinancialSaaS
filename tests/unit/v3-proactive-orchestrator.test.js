import { describe, expect, it } from 'vitest'
import {
  buildFirstStepsChecklist,
  buildProactiveFinancialAgenda,
  v33AgendaFactsForAI,
} from '@/domain/v3/proactiveOrchestrator.js'

const referenceDate = '2026-07-23'

const baseState = {
  settings: { year: 2026, selectedMonth: 7 },
  incomes: [],
  expenses: [],
  financialAccounts: [],
  creditCards: [],
  planningGoals: [],
  subscriptions: [],
  wishlist: [],
  importSessions: [],
}

function monthlySubscription(overrides = {}) {
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
    ...overrides,
  }
}

describe('V3.3 proactive financial agenda', () => {
  it('prioritizes missing income before spending recommendations', () => {
    const agenda = buildProactiveFinancialAgenda({
      state: baseState,
      monthData: { incomeCash: 0, cashExpenses: 0, cardBill: 0, cashBalance: 0 },
      subscriptionSummary: { totalMonthly: 0, next7Days: [], next30Days: [], alerts: [] },
      commandCenter: { mode: 'setup', actions: [] },
      referenceDate,
    })

    expect(agenda.nextBestAction).toMatchObject({
      key: 'first-income',
      title: 'Cadastre sua primeira receita',
      route: '/entries',
      priority: 'critical',
      horizon: 'today',
    })
    expect(agenda.blockers).toContainEqual(expect.objectContaining({
      key: 'missing-income',
      route: '/entries',
    }))
    expect(agenda.blockedMetrics).toEqual(['safe-spend', 'purchase-capacity', 'advanced-forecast'])
    expect(agenda.items[0].key).toBe('first-income')
  })

  it('shows upcoming subscription charges in the next seven days', () => {
    const agenda = buildProactiveFinancialAgenda({
      state: {
        ...baseState,
        incomes: [{ id: 'inc-1', amount: 5000, date: '2026-07-01' }],
        subscriptions: [monthlySubscription()],
      },
      monthData: { incomeCash: 5000, cashExpenses: 1500, cardBill: 600, cashBalance: 3200 },
      subscriptionSummary: {
        totalMonthly: 39.9,
        dispensableMonthly: 39.9,
        next7Days: [monthlySubscription()],
        next30Days: [monthlySubscription()],
        alerts: [],
      },
      commandCenter: { mode: 'optimize', actions: [] },
      referenceDate,
    })

    expect(agenda.items).toContainEqual(expect.objectContaining({
      key: 'subscription-sub-netflix',
      type: 'subscription-charge',
      title: 'Netflix vence em 2 dias',
      route: '/subscriptions',
      dueDate: '2026-07-25',
      impactAmount: 39.9,
      horizon: 'next7',
    }))
    expect(agenda.grouped.next7.map((item) => item.key)).toContain('subscription-sub-netflix')
  })

  it('raises pending OCR or statement review above optimization advice', () => {
    const agenda = buildProactiveFinancialAgenda({
      state: {
        ...baseState,
        incomes: [{ id: 'inc-1', amount: 5000, date: '2026-07-01' }],
      },
      monthData: { incomeCash: 5000, cashExpenses: 1200, cardBill: 300, cashBalance: 3500 },
      pendingReviews: [{ id: 'ocr-1', kind: 'ocr', count: 1 }],
      subscriptionSummary: { totalMonthly: 0, next7Days: [], next30Days: [], alerts: [] },
      commandCenter: { mode: 'operate', actions: [] },
      referenceDate,
    })

    expect(agenda.nextBestAction).toMatchObject({
      key: 'review-ocr-1',
      title: 'Revise 1 lancamento reconhecido',
      route: '/entries',
      priority: 'high',
      horizon: 'today',
    })
    expect(agenda.alerts[0].key).toBe('review-ocr-1')
  })

  it('calculates dispensable subscription savings with monthly and annual impact', () => {
    const agenda = buildProactiveFinancialAgenda({
      state: {
        ...baseState,
        incomes: [{ id: 'inc-1', amount: 4500, date: '2026-07-01' }],
        subscriptions: [monthlySubscription()],
      },
      monthData: { incomeCash: 4500, cashExpenses: 1800, cardBill: 700, cashBalance: 2600 },
      subscriptionSummary: {
        totalMonthly: 39.9,
        dispensableMonthly: 39.9,
        next7Days: [],
        next30Days: [monthlySubscription()],
        alerts: [],
      },
      commandCenter: { mode: 'optimize', actions: [] },
      referenceDate,
    })

    expect(agenda.items).toContainEqual(expect.objectContaining({
      key: 'cut-dispensable-subscriptions',
      type: 'optimization',
      title: 'Corte assinaturas dispensaveis',
      route: '/subscriptions',
      impactAmount: 39.9,
      annualImpactAmount: 478.8,
    }))
    expect(agenda.impact).toMatchObject({
      avoidableMonthly: 39.9,
      avoidableAnnual: 478.8,
    })
  })

  it('exports compact facts for AI without raw technical labels', () => {
    const agenda = buildProactiveFinancialAgenda({
      state: {
        ...baseState,
        incomes: [{ id: 'inc-1', amount: 5000, date: '2026-07-01' }],
        subscriptions: [monthlySubscription()],
      },
      monthData: { incomeCash: 5000, cashExpenses: 1500, cardBill: 600, cashBalance: 3200 },
      subscriptionSummary: {
        totalMonthly: 39.9,
        dispensableMonthly: 39.9,
        next7Days: [monthlySubscription()],
        next30Days: [monthlySubscription()],
        alerts: [],
      },
      commandCenter: { mode: 'optimize', actions: [] },
      referenceDate,
    })
    const facts = v33AgendaFactsForAI(agenda)

    expect(facts.nextBestAction).toMatchObject({
      key: expect.any(String),
      title: expect.any(String),
      route: expect.any(String),
      priority: expect.any(String),
    })
    expect(facts.items.length).toBeGreaterThan(0)
    expect(JSON.stringify(facts)).not.toMatch(/stable|undefined|null/)
  })

  it('builds a short first-steps checklist for new users', () => {
    const steps = buildFirstStepsChecklist(baseState)

    expect(steps).toEqual([
      expect.objectContaining({ key: 'first-income', label: 'Cadastrar receita', route: '/entries', status: 'current' }),
      expect.objectContaining({ key: 'first-expense', label: 'Registrar despesa', route: '/entries', status: 'locked' }),
      expect.objectContaining({ key: 'first-goal', label: 'Criar meta', route: '/goals', status: 'locked' }),
      expect.objectContaining({ key: 'review-month', label: 'Revisar resumo', route: '/dashboard', status: 'locked' }),
    ])
  })
})
