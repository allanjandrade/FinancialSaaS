import { release2FinancialState } from '../../tests/fixtures/release2-financial-state.js'
import { normalizeFinanceState } from '../../supabase/functions/_shared/financial-engine/normalize-state.js'
import {
  calculateBenefitBurnRate,
  calculateCardRisk,
  calculateCategoryAnomalies,
  calculateFinancialSnapshot,
  calculateMonthEndProjection,
  calculatePurchaseSimulation,
} from '../../supabase/functions/_shared/financial-engine/calculations.js'

function state() {
  return normalizeFinanceState(release2FinancialState(), '2026-06-12')
}

describe('Release 2 deterministic financial calls', () => {
  it('returns the consolidated financial snapshot', () => {
    expect(calculateFinancialSnapshot(state())).to.include({ netWorth: 8280, monthlyIncome: 3000 })
  })

  it('returns the month-end projection', () => {
    const result = calculateMonthEndProjection(state())
    expect(result.projectedExpenses).to.be.greaterThan(result.confirmedExpenses)
    expect(result.confidence).to.be.within(0.01, 1)
  })

  it('simulates a purchase with an auditable decision', () => {
    const result = calculatePurchaseSimulation(state(), {
      amount: 800,
      paymentMethod: 'credit_card',
      installments: 4,
      category: 'Auto',
    })
    expect(result).to.include({ monthlyImpact: 200, recommendedDecision: 'wait' })
    expect(result.reasons).not.to.be.empty
  })

  it('calculates VA burn rate without mixing bank cash', () => {
    expect(calculateBenefitBurnRate(state(), 'VA')).to.include({ status: 'risk', projectedEndBalance: -318 })
  })

  it('returns card risk and reasons', () => {
    const result = calculateCardRisk(state())
    expect(result).to.include({ riskLevel: 'attention', totalOpenBill: 920 })
    expect(result.reasons).not.to.be.empty
  })

  it('detects a material category anomaly', () => {
    const result = calculateCategoryAnomalies(state(), 3)
    expect(result.anomalies.find((item) => item.category === 'Mercado')).to.include({ severity: 'attention' })
  })
})
