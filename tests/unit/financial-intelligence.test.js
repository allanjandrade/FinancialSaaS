import { describe, expect, it } from 'vitest'
import {
  buildFinancialIntelligence,
  financialSnapshotContent,
} from '@/utils/financial-intelligence.js'

function calcMonth(month) {
  const rows = {
    4: { incomeCash: 5000, vaIncome: 0, cashExpenses: 2600, cardBill: 700 },
    5: { incomeCash: 5000, vaIncome: 0, cashExpenses: 2800, cardBill: 800 },
    6: { incomeCash: 5000, vaIncome: 0, cashExpenses: 3400, cardBill: 1200 },
  }
  return rows[month] || { incomeCash: 0, vaIncome: 0, cashExpenses: 0, cardBill: 0 }
}

const state = {
  settings: {
    year: 2026,
    selectedMonth: 6,
    cardLimit: 1500,
    emergencyReserveCurrent: 1000,
    emergencyReserveMinimum: 6000,
    monthlyRecurringExpenses: 0,
    monthlyDebtPayments: 0,
  },
  incomes: [{ id: 'i1' }],
  expenses: [
    { id: 'a', date: '2026-04-10', category: 'Mercado', amount: 500 },
    { id: 'b', date: '2026-05-10', category: 'Mercado', amount: 600 },
    { id: 'c', date: '2026-06-10', category: 'Mercado', amount: 1100 },
  ],
  creditCards: [],
  priceMonitorAlerts: [],
}

describe('financial intelligence', () => {
  it('builds deterministic diagnosis, forecast and prioritized actions', () => {
    const result = buildFinancialIntelligence(state, calcMonth)

    expect(result.current.income).toBe(5000)
    expect(result.current.expense).toBe(4600)
    expect(result.current.surplus).toBe(400)
    expect(result.card.utilization).toBe(80)
    expect(result.reserve.gap).toBe(5000)
    expect(result.categories.anomalies[0].category).toBe('Mercado')
    expect(result.actions[0].severity).toBe('critical')
    expect(result.actions.some((item) => item.id === 'reduce-card')).toBe(true)
  })

  it('serializes only aggregate financial facts for vector memory', () => {
    const result = buildFinancialIntelligence(state, calcMonth)
    const content = financialSnapshotContent(result)

    expect(content).toContain('Resumo financeiro do período 202606')
    expect(content).toContain('Projeção do próximo ciclo')
    expect(content).not.toContain('2026-06-10')
  })
})
