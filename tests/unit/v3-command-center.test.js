import { describe, expect, it } from 'vitest'
import { buildV3CommandCenter } from '@/domain/v3/commandCenter.js'

const baseState = {
  settings: { year: 2026, selectedMonth: 7 },
  incomes: [],
  expenses: [],
  financialAccounts: [],
  creditCards: [],
  planningGoals: [],
  subscriptions: [],
  wishlist: [],
  priceMonitorAlerts: [],
}

describe('V3 command center', () => {
  it('prioritizes first income setup when the user has no usable financial base', () => {
    const command = buildV3CommandCenter({
      state: baseState,
      executiveSummary: {
        needsIncomeSetup: true,
        safeToSpend: 0,
        risk: 'attention',
      },
      subscriptionSummary: { totalMonthly: 0, nextCharge: null, alerts: [] },
      monthData: { incomeCash: 0, cashExpenses: 0, cardBill: 0, cashBalance: 0 },
      availableBalance: 0,
    })

    expect(command.mode).toBe('setup')
    expect(command.primaryAction).toMatchObject({
      label: 'Cadastrar primeira receita',
      route: '/entries',
      intent: 'income',
    })
    expect(command.headline).toContain('Receita')
    expect(command.kpis.map((item) => item.key)).toEqual(['income', 'expenses', 'balance'])
  })

  it('surfaces dispensable subscriptions as monthly economy opportunity', () => {
    const command = buildV3CommandCenter({
      state: {
        ...baseState,
        incomes: [{ amount: 5000 }],
        subscriptions: [
          { id: 'netflix', name: 'Netflix', amount: 39.9, billing_cycle: 'monthly', status: 'active', is_essential: false },
          { id: 'icloud', name: 'iCloud', amount: 14.9, billing_cycle: 'monthly', status: 'active', is_essential: true },
        ],
      },
      executiveSummary: { needsIncomeSetup: false, safeToSpend: 1800, risk: 'normal' },
      subscriptionSummary: {
        totalMonthly: 54.8,
        nextCharge: { name: 'Netflix', amount: 39.9, daysUntil: 2 },
        alerts: [],
      },
      monthData: { incomeCash: 5000, cashExpenses: 1200, cardBill: 500, cashBalance: 3000 },
      availableBalance: 2500,
    })

    expect(command.mode).toBe('optimize')
    expect(command.primaryAction).toMatchObject({
      label: 'Revisar assinaturas dispensáveis',
      route: '/subscriptions',
    })
    expect(command.kpis).toContainEqual(expect.objectContaining({
      key: 'subscriptionSavings',
      value: 39.9,
    }))
    expect(command.actions).toContainEqual(expect.objectContaining({
      route: '/subscriptions',
      label: 'Cortar ou pausar assinatura',
    }))
  })

  it('warns against new purchases when cash flow is tight and wishlist has pending items', () => {
    const command = buildV3CommandCenter({
      state: {
        ...baseState,
        incomes: [{ amount: 4200 }],
        expenses: [{ amount: 2900 }],
        wishlist: [{ id: 'phone', name: 'Celular novo', value: 3200, status: 'quote_pending' }],
      },
      executiveSummary: { needsIncomeSetup: false, safeToSpend: 0, risk: 'critical' },
      subscriptionSummary: { totalMonthly: 0, nextCharge: null, alerts: [] },
      monthData: { incomeCash: 4200, cashExpenses: 2900, cardBill: 1400, cashBalance: 200 },
      availableBalance: -1200,
    })

    expect(command.mode).toBe('protect')
    expect(command.primaryAction).toMatchObject({
      label: 'Reequilibrar caixa do mês',
      route: '/entries',
    })
    expect(command.actionPlan).toContainEqual(expect.objectContaining({
      key: 'freeze-wishlist',
      route: '/purchases',
    }))
    expect(command.risks).toContainEqual(expect.objectContaining({
      key: 'negativeBalance',
      severity: 'critical',
    }))
  })

  it('keeps a stable operating mode when the month has healthy margin and no urgent risk', () => {
    const command = buildV3CommandCenter({
      state: {
        ...baseState,
        incomes: [{ amount: 7000 }],
        expenses: [{ amount: 1600 }],
        planningGoals: [{ id: 'reserve', name: 'Reserva', target_amount: 12000, current_amount: 6000, status: 'active' }],
      },
      executiveSummary: { needsIncomeSetup: false, safeToSpend: 2500, risk: 'normal' },
      subscriptionSummary: { totalMonthly: 80, nextCharge: { name: 'Spotify', amount: 21.9, daysUntil: 8 }, alerts: [] },
      monthData: { incomeCash: 7000, cashExpenses: 1600, cardBill: 900, cashBalance: 4000 },
      availableBalance: 3100,
    })

    expect(command.mode).toBe('operate')
    expect(command.primaryAction).toMatchObject({
      label: 'Acompanhar próximos vencimentos',
      route: '/plan',
    })
    expect(command.actions.map((item) => item.route)).toContain('/goals')
  })
})
