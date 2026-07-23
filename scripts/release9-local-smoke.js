import assert from 'node:assert/strict'
import { buildAdvisorReport, buildPredictiveSnapshot, simulateScenario, validateAdvisorFeedback } from '../src/domain/predictive/index.js'

const state = {
  settings: { year: 2026, selectedMonth: 6, minimumReserve: 1000 },
  financialAccounts: [{ balance: 6000 }],
  incomes: [{ date: '2026-06-05', type: 'Salario', amount: 5000 }],
  expenses: [
    { date: '2026-06-02', category: 'Mercado', amount: 900, payment: 'Pix' },
    { date: '2026-06-10', category: 'Lazer', amount: 500, payment: 'Pix' },
    { date: '2026-06-12', category: 'Outros', amount: 1000, isInternalTransfer: true },
    { date: '2026-06-12', category: 'Mercado', amount: 300, payment: 'VA' },
  ],
  categoryBudgets: [{ month_key: 202606, category: 'Mercado', planned: 1200 }],
}

const snapshot = buildPredictiveSnapshot(state, '2026-06-15')
const scenario = simulateScenario(state, 'critical', '2026-06-15')
const report = buildAdvisorReport(state, '2026-06-15')
const feedback = validateAdvisorFeedback({ recommendation_id: 'local-rec-1', feedback: 'useful' })

assert.equal(snapshot.source, 'deterministic')
assert.equal(snapshot.forbiddenActions.automaticFinancialWrite, false)
assert.equal(report.aiMayExplainOnly, true)
assert.equal(scenario.scenario, 'critical')
assert.equal(feedback.feedback, 'useful')

console.log(JSON.stringify({
  status: 'PASS',
  projectedClosing: snapshot.summary.projectedClosing,
  safeInvestmentCapacity: snapshot.summary.safeInvestmentCapacity,
  recommendations: report.recommendations.length,
}, null, 2))
console.log('Release 9 local smoke: PASS')
