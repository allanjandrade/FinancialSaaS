import { describe, expect, it } from 'vitest'
import { release2FinancialState } from '../fixtures/release2-financial-state.js'
import { normalizeFinanceState } from '../../supabase/functions/_shared/financial-engine/normalize-state.ts'
import {
  calculateBenefitBurnRate,
  calculateCardRisk,
  calculateCategoryAnomalies,
  calculateFinancialSnapshot,
  calculateMonthEndProjection,
  calculatePurchaseSimulation,
  calculateRecurringSuggestions,
} from '../../supabase/functions/_shared/financial-engine/calculations.ts'

function normalized() {
  return normalizeFinanceState(release2FinancialState(), '2026-06-12')
}

describe('Release 2 deterministic financial engine', () => {
  it('normalizes finance_states and marks confirmed internal transfers', () => {
    const state = normalized()
    expect(state.period).toEqual({ start: '2026-06-01', end: '2026-06-30' })
    expect(state.transactions.filter((item) => item.isInternalTransfer)).toHaveLength(2)
    expect(state.transactions.find((item) => item.id === 'market-jun')?.category).toBe('Mercado')
  })

  it('builds a snapshot without benefits, limits or internal transfers in net worth', () => {
    const result = calculateFinancialSnapshot(normalized())
    expect(result.realCashBalance).toBe(8200)
    expect(result.investments).toBe(1000)
    expect(result.benefitsBalance).toBe(432)
    expect(result.creditCardOpenAmount).toBe(920)
    expect(result.netWorth).toBe(8280)
    expect(result.monthlyIncome).toBe(3000)
    expect(result.benefitsExcludedFromNetWorth).toBe(true)
    expect(result.availableToSpend).toBeLessThan(8200)
  })

  it('projects benefit depletion using only matching debit transactions', () => {
    const result = calculateBenefitBurnRate(normalized(), 'VA')
    expect(result.spentSoFar).toBe(400)
    expect(result.dailyAverage).toBe(33.33)
    expect(result.projectedEndBalance).toBe(-318)
    expect(result.status).toBe('risk')
    expect(result.estimatedDepletionDate).toBe('2026-06-20')
  })

  it('classifies card risk from bill-to-income ratio and due date', () => {
    const result = calculateCardRisk(normalized())
    expect(result.totalOpenBill).toBe(920)
    expect(result.billToIncomeRatio).toBe(0.3067)
    expect(result.limitUsageRatio).toBe(0.46)
    expect(result.daysToDueDate).toBe(8)
    expect(result.riskLevel).toBe('attention')
  })

  it('projects month end with explicit confidence and warnings', () => {
    const result = calculateMonthEndProjection(normalized())
    expect(result.confirmedIncome).toBe(3000)
    expect(result.projectedExpenses).toBeGreaterThan(result.confirmedExpenses)
    expect(result.projectedCardBill).toBe(920)
    expect(result.confidence).toBeGreaterThan(0)
    expect(result.confidence).toBeLessThanOrEqual(1)
  })

  it('keeps non-VA corporate benefits isolated without breaking projection', () => {
    const source = release2FinancialState()
    source.benefitWallets.push({ id: 'corp', name: 'Mobilidade', kind: 'corporate', balance: 90 })
    const result = calculateMonthEndProjection(normalizeFinanceState(source, '2026-06-12'))
    expect(result.projectedBenefitBalance).toBe(240)
  })

  it('detects relevant category anomalies and ignores tiny percentage spikes', () => {
    const result = calculateCategoryAnomalies(normalized(), 3)
    const market = result.anomalies.find((item) => item.category === 'Mercado')
    const fees = result.anomalies.find((item) => item.category === 'Taxas')
    expect(market).toMatchObject({ historicalAverage: 620, difference: 220, severity: 'attention' })
    expect(fees?.severity).toBe('normal')
  })

  it('simulates installment impact without writing to state', () => {
    const source = release2FinancialState()
    const before = JSON.stringify(source)
    const result = calculatePurchaseSimulation(normalizeFinanceState(source, '2026-06-12'), {
      amount: 800,
      paymentMethod: 'credit_card',
      installments: 4,
      category: 'Auto',
      description: 'Lanterna traseira Punto',
    })
    expect(result.monthlyImpact).toBe(200)
    expect(result.recommendedDecision).toBe('wait')
    expect(result.impactOnCardRisk).toBe('attention_to_risk')
    expect(JSON.stringify(source)).toBe(before)
  })

  it('rejects a benefit payment for an incompatible category', () => {
    const result = calculatePurchaseSimulation(normalized(), {
      amount: 100,
      paymentMethod: 'VA',
      category: 'Auto',
    })
    expect(result.recommendedDecision).toBe('avoid')
    expect(result.assumptions.benefitCategoryAllowed).toBe(false)
  })

  it('suggests recurring items but never creates a rule', () => {
    const state = normalized()
    const before = state.recurringRules.length
    const result = calculateRecurringSuggestions(state, 6)
    const netflix = result.suggestions.find((item) => item.descriptionPattern === 'Netflix')
    expect(netflix?.lastOccurrences).toHaveLength(3)
    expect(netflix?.suggestedRule).toMatchObject({ type: 'expense', amount: 39.9, dayOfMonth: 10 })
    expect(state.recurringRules).toHaveLength(before)
  })
})
