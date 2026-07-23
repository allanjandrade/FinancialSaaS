import { describe, expect, it } from 'vitest'
import {
  buildV3ActionPlan,
  buildV3CommandCenter,
  buildV3FinancialScore,
  v3CommandFactsForAI,
} from '@/domain/v3/commandCenter.js'

const healthyState = {
  settings: {
    year: 2026,
    selectedMonth: 7,
    emergencyReserveCurrent: 12000,
    emergencyReserveMinimum: 9000,
  },
  incomes: [{ amount: 8000 }],
  expenses: [{ amount: 2200, category: 'Moradia' }],
  financialAccounts: [{ balance: 6000 }],
  creditCards: [{ limit: 9000, availableLimit: 7200 }],
  planningGoals: [{ id: 'reserve', name: 'Reserva', target_amount: 15000, current_amount: 12000, status: 'active' }],
  subscriptions: [{ id: 'spotify', name: 'Spotify', amount: 21.9, billing_cycle: 'monthly', status: 'active', is_essential: true }],
  wishlist: [],
  priceMonitorAlerts: [],
}

const riskyState = {
  settings: {
    year: 2026,
    selectedMonth: 7,
    emergencyReserveCurrent: 500,
    emergencyReserveMinimum: 6000,
  },
  incomes: [{ amount: 4200 }],
  expenses: [{ amount: 2800, category: 'Cartão' }],
  financialAccounts: [{ balance: -200 }],
  creditCards: [{ limit: 5000, availableLimit: 400 }],
  planningGoals: [],
  subscriptions: [
    { id: 'netflix', name: 'Netflix', amount: 39.9, billing_cycle: 'monthly', status: 'active', is_essential: false },
    { id: 'chatgpt', name: 'ChatGPT', amount: 99.9, billing_cycle: 'monthly', status: 'active', is_essential: false },
  ],
  wishlist: [{ id: 'phone', name: 'Celular novo', value: 3200, status: 'quote_pending' }],
  priceMonitorAlerts: [{ id: 'alert-1', status: 'open', message: 'Preço caiu' }],
}

describe('V3 deep command center', () => {
  it('builds a financial score with explicit pillars and improvement levers', () => {
    const score = buildV3FinancialScore({
      state: healthyState,
      monthData: { incomeCash: 8000, cashExpenses: 2200, cardBill: 500, cashBalance: 6000 },
      availableBalance: 5500,
      subscriptionSummary: { totalMonthly: 21.9, nextCharge: null, alerts: [] },
    })

    expect(score.score).toBeGreaterThanOrEqual(75)
    expect(score.level).toBe('strong')
    expect(score.pillars.map((pillar) => pillar.key)).toEqual([
      'cashflow',
      'reserve',
      'cardPressure',
      'recurrence',
      'goals',
    ])
    expect(score.improvementLevers[0]).toMatchObject({
      key: 'maintain-cadence',
      label: 'Manter cadência',
    })
  })

  it('lowers the score and produces prioritized actions when cash, card and subscriptions are risky', () => {
    const score = buildV3FinancialScore({
      state: riskyState,
      monthData: { incomeCash: 4200, cashExpenses: 2800, cardBill: 2600, cashBalance: -200 },
      availableBalance: -2800,
      subscriptionSummary: { totalMonthly: 139.8, nextCharge: { name: 'Netflix', amount: 39.9, daysUntil: 2 }, alerts: [] },
    })
    const plan = buildV3ActionPlan({
      state: riskyState,
      score,
      executiveSummary: { needsIncomeSetup: false, safeToSpend: 0, risk: 'critical' },
      subscriptionSummary: { totalMonthly: 139.8, nextCharge: { name: 'Netflix', amount: 39.9, daysUntil: 2 }, alerts: [] },
      monthData: { incomeCash: 4200, cashExpenses: 2800, cardBill: 2600, cashBalance: -200 },
      availableBalance: -2800,
    })

    expect(score.score).toBeLessThan(55)
    expect(score.level).toBe('fragile')
    expect(plan[0]).toMatchObject({
      key: 'restore-cashflow',
      priority: 'critical',
      route: '/entries',
    })
    expect(plan.map((action) => action.key)).toContain('pause-disposable-subscriptions')
    expect(plan.map((action) => action.key)).toContain('freeze-wishlist')
    expect(plan.every((action) => action.status === 'pending')).toBe(true)
  })

  it('embeds score, action plan and north star into the command center output', () => {
    const command = buildV3CommandCenter({
      state: riskyState,
      executiveSummary: { needsIncomeSetup: false, safeToSpend: 0, risk: 'critical' },
      subscriptionSummary: { totalMonthly: 139.8, nextCharge: { name: 'Netflix', amount: 39.9, daysUntil: 2 }, alerts: [] },
      monthData: { incomeCash: 4200, cashExpenses: 2800, cardBill: 2600, cashBalance: -200 },
      availableBalance: -2800,
    })

    expect(command.score).toMatchObject({ level: 'fragile' })
    expect(command.actionPlan.length).toBeGreaterThanOrEqual(3)
    expect(command.northStar).toContain('Preservar caixa')
    expect(command.primaryAction.key).toBe(command.actionPlan[0].key)
  })

  it('exports compact command facts for the consultative AI', () => {
    const command = buildV3CommandCenter({
      state: riskyState,
      executiveSummary: { needsIncomeSetup: false, safeToSpend: 0, risk: 'critical' },
      subscriptionSummary: { totalMonthly: 139.8, nextCharge: { name: 'Netflix', amount: 39.9, daysUntil: 2 }, alerts: [] },
      monthData: { incomeCash: 4200, cashExpenses: 2800, cardBill: 2600, cashBalance: -200 },
      availableBalance: -2800,
    })
    const facts = v3CommandFactsForAI(command)

    expect(facts.score).toBe(command.score.score)
    expect(facts.level).toBe('fragile')
    expect(facts.northStar).toContain('Preservar caixa')
    expect(facts.actions[0]).toMatchObject({
      key: 'restore-cashflow',
      priority: 'critical',
      route: '/entries',
    })
  })
})
