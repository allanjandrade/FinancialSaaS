import { describe, it, expect } from 'vitest'
import {
  computeFinancialMaturity,
  syncMaturityHistory,
  buildMaturitySnapshot,
  getMaturityChartSeries,
  getCalendarMonthKey,
  formatMonthKeyLabel,
} from '@/utils/financial-maturity.js'

function calcMonth(m) {
  const income = m <= 3 ? 5000 : 4000
  const expense = m <= 3 ? 3500 : 4800
  return {
    incomeCash: income,
    vaIncome: 0,
    cashExpenses: expense * 0.6,
    cardBill: expense * 0.4,
  }
}

function baseState(overrides = {}) {
  return {
    settings: {
      year: 2026,
      emergencyReserveCurrent: 6000,
      emergencyReserveMinimum: 5000,
      cardLimit: 10000,
      maturityHistory: [],
      ...overrides.settings,
    },
    expenses: [],
    wishlist: [{ id: 'w1', monitorPrice: true, priceHistory: [{ price: 100 }, { price: 90 }] }],
    priorityQueue: [{ id: 'q1' }],
    ...overrides,
  }
}

describe('computeFinancialMaturity', () => {
  it('retorna score entre 0 e 100', () => {
    const result = computeFinancialMaturity(baseState(), calcMonth)
    expect(result.overall).toBeGreaterThanOrEqual(0)
    expect(result.overall).toBeLessThanOrEqual(100)
    expect(result.dimensions).toHaveProperty('spendingControl')
    expect(result.dimensions).toHaveProperty('emergencyReserve')
    expect(result.level).toBeTruthy()
  })

  it('reserva de emergência alta melhora dimensão', () => {
    const good = computeFinancialMaturity(
      baseState({ settings: { emergencyReserveCurrent: 10000, emergencyReserveMinimum: 5000 } }),
      calcMonth,
    )
    const low = computeFinancialMaturity(
      baseState({ settings: { emergencyReserveCurrent: 0, emergencyReserveMinimum: 5000 } }),
      calcMonth,
    )
    expect(good.dimensions.emergencyReserve).toBeGreaterThan(low.dimensions.emergencyReserve)
  })
})

describe('syncMaturityHistory', () => {
  it('atualiza entrada do mesmo mês', () => {
    const snap = { monthKey: 202606, overall: 70, dimensions: {}, at: '2026-06-01' }
    const history = syncMaturityHistory([{ monthKey: 202606, overall: 50, dimensions: {} }], {
      ...snap,
      overall: 72,
    })
    expect(history).toHaveLength(1)
    expect(history[0].overall).toBe(72)
  })

  it('mantém no máximo 24 meses', () => {
    const history = Array.from({ length: 25 }, (_, i) => ({
      monthKey: 202400 + i,
      overall: 50,
      dimensions: {},
    }))
    const next = syncMaturityHistory(history, { monthKey: 202625, overall: 60, dimensions: {} })
    expect(next.length).toBeLessThanOrEqual(24)
  })
})

describe('buildMaturitySnapshot', () => {
  it('inclui monthKey e overall', () => {
    const snap = buildMaturitySnapshot(baseState(), calcMonth)
    expect(snap.monthKey).toBe(getCalendarMonthKey())
    expect(typeof snap.overall).toBe('number')
    expect(snap.at).toBeTruthy()
  })
})

describe('getMaturityChartSeries', () => {
  it('ordena por monthKey', () => {
    const series = getMaturityChartSeries([
      { monthKey: 202605, overall: 60, dimensions: { spendingControl: 55 } },
      { monthKey: 202603, overall: 50, dimensions: { spendingControl: 48 } },
    ])
    expect(series[0].monthKey).toBe(202603)
    expect(series[1].label).toMatch(/mai/i)
  })
})

describe('formatMonthKeyLabel', () => {
  it('formata chave yyyyMM', () => {
    expect(formatMonthKeyLabel(202606)).toMatch(/jun/i)
  })
})
