import assert from 'node:assert/strict'
import { release2FinancialState } from '../tests/fixtures/release2-financial-state.js'
import { normalizeFinanceState } from '../supabase/functions/_shared/financial-engine/normalize-state.ts'
import {
  calculateBenefitBurnRate,
  calculateCardRisk,
  calculateCategoryAnomalies,
  calculateFinancialSnapshot,
  calculateMonthEndProjection,
  calculatePurchaseSimulation,
  calculateRecurringSuggestions,
} from '../supabase/functions/_shared/financial-engine/calculations.ts'

const source = release2FinancialState()
const normalized = normalizeFinanceState(source, '2026-06-12')
const snapshot = calculateFinancialSnapshot(normalized)
const benefit = calculateBenefitBurnRate(normalized, 'VA')
const card = calculateCardRisk(normalized)
const projection = calculateMonthEndProjection(normalized)
const anomalies = calculateCategoryAnomalies(normalized, 3)
const simulation = calculatePurchaseSimulation(normalized, {
  amount: 800,
  paymentMethod: 'credit_card',
  installments: 4,
  category: 'Auto',
  description: 'Lanterna traseira Punto',
})
const recurring = calculateRecurringSuggestions(normalized, 6)

assert.equal(snapshot.netWorth, 8280)
assert.equal(snapshot.benefitsExcludedFromNetWorth, true)
assert.equal(snapshot.monthlyIncome, 3000)
assert.equal(benefit.status, 'risk')
assert.equal(benefit.projectedEndBalance, -318)
assert.equal(card.riskLevel, 'attention')
assert.equal(card.daysToDueDate, 8)
assert.equal(projection.projectedCardBill, 920)
assert.ok(projection.confidence > 0 && projection.confidence <= 1)
assert.equal(anomalies.anomalies.find((item) => item.category === 'Mercado')?.severity, 'attention')
assert.equal(anomalies.anomalies.find((item) => item.category === 'Taxas')?.severity, 'normal')
assert.equal(simulation.recommendedDecision, 'wait')
assert.equal(simulation.monthlyImpact, 200)
assert.ok(recurring.suggestions.some((item) => item.descriptionPattern === 'Netflix'))
assert.equal(normalized.transactions.filter((item) => item.isInternalTransfer).length, 2)

console.log(JSON.stringify({
  status: 'PASS',
  referenceDate: normalized.referenceDate,
  snapshot: {
    netWorth: snapshot.netWorth,
    availableToSpend: snapshot.availableToSpend,
    safeToInvest: snapshot.safeToInvest,
  },
  benefit: { status: benefit.status, projectedEndBalance: benefit.projectedEndBalance },
  card: { riskLevel: card.riskLevel, billToIncomeRatio: card.billToIncomeRatio },
  projection: { netCashFlow: projection.projectedNetCashFlow, confidence: projection.confidence },
  anomalies: anomalies.anomalies.map(({ category, channel, severity }) => ({ category, channel, severity })),
  simulation: { decision: simulation.recommendedDecision, monthlyImpact: simulation.monthlyImpact },
  recurringSuggestions: recurring.suggestions.length,
}, null, 2))
