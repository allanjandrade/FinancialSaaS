import assert from 'node:assert/strict'
import { buildAdvisorReport, buildPredictiveSnapshot, simulateScenario } from '../src/domain/predictive/index.js'

const state = {
  settings: { year: 2026, selectedMonth: 6, minimumReserve: 1000 },
  financialAccounts: [{ balance: 6000 }],
  incomes: [{ date: '2026-06-05', type: 'Salario', amount: 5000 }],
  expenses: [
    { date: '2026-06-03', category: 'Mercado', amount: 900, payment: 'Pix' },
    { date: '2026-06-08', category: 'Lazer', amount: 450, payment: 'Pix' },
    { date: '2026-06-10', category: 'Outros', amount: 1000, isInternalTransfer: true },
    { date: '2026-06-10', category: 'Mercado', amount: 300, payment: 'VA' },
  ],
  categoryBudgets: [{ month_key: 202606, category: 'Mercado', planned: 1200 }],
}

const snapshot = buildPredictiveSnapshot(state, '2026-06-15')
const critical = simulateScenario(state, 'critical', '2026-06-15')
const report = buildAdvisorReport(state, '2026-06-15')

assert.equal(snapshot.source, 'deterministic')
assert.equal(snapshot.forbiddenActions.aiGeneratedNumbers, false)
assert.ok(snapshot.categories.some((item) => item.category === 'Mercado' && item.actual === 900))
assert.ok(snapshot.projection.projectedBalance <= snapshot.projection.confirmedIncome)
assert.ok(snapshot.investment.safeCapacity >= 0)
assert.equal(snapshot.scenarios.length, 3)
assert.ok(critical.projectedExpenses > snapshot.projection.projectedExpenses)
assert.equal(report.aiMayExplainOnly, true)

console.log('Predictive engine validation: PASS')
