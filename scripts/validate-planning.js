import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import {
  buildMonthlyPlan,
  simulatePlannedPurchase,
} from '../src/utils/planning-engine.js'
import {
  chooseBestCompatibleOffer,
  normalizeProductIdentity,
} from '../src/utils/productIdentity.js'

const root = process.cwd()
const requiredFiles = [
  'src/utils/planning-engine.js',
  'src/utils/productIdentity.js',
  'src/views/Planner.vue',
  'tests/unit/release8-planning.test.js',
  'cypress/e2e/release8-planning.cy.js',
  'supabase/functions/_shared/product-identity/index.ts',
]

for (const file of requiredFiles) {
  assert.ok(fs.existsSync(path.join(root, file)), `Arquivo obrigatorio ausente: ${file}`)
}

const router = fs.readFileSync(path.join(root, 'src/router/index.js'), 'utf8')
for (const route of ['/plan', '/plan/purchase-simulator']) {
  assert.ok(router.includes(route), `Rota de planejamento ausente: ${route}`)
}

const packageJson = fs.readFileSync(path.join(root, 'package.json'), 'utf8')
assert.ok(packageJson.includes('validate:planning'), 'Script validate:planning ausente.')

const forbidden = [
  'Apps Script',
  'WhatsApp',
  'Telegram',
  'Google Sheets',
  'Google Drive',
  'Gmail',
  'script livre',
  'open finance scraping',
]

for (const file of ['src/views/Planner.vue', 'src/utils/planning-engine.js', 'src/utils/productIdentity.js']) {
  const content = fs.readFileSync(path.join(root, file), 'utf8')
  for (const term of forbidden) {
    assert.equal(content.includes(term), false, `${file} contem termo/fluxo proibido: ${term}`)
  }
}

const state = {
  settings: { year: 2026, selectedMonth: 6, cardClosingDay: 20 },
  incomes: [{ date: '2026-06-05', type: 'Salario', amount: 5000 }],
  expenses: [
    { date: '2026-06-06', category: 'Mercado', payment: 'Debito', amount: 400 },
    { date: '2026-06-07', category: 'Outros', payment: 'Pix', amount: 900, isInternalTransfer: true },
    { date: '2026-06-08', category: 'Cartao', payment: 'Credito', amount: 600, cardCompetencyMonth: 6, cardCompetencyYear: 2026 },
  ],
  planningGoals: [{ name: 'Reserva', type: 'reserva_emergencia', target_amount: 10000, current_amount: 1000, monthly_contribution: 300, status: 'active' }],
  categoryBudgets: [{ month_key: 202606, category: 'Mercado', planned: 800 }],
}

const plan = buildMonthlyPlan(state, new Date('2026-06-19T12:00:00'))
assert.equal(plan.income_cash, 5000)
assert.equal(plan.projected_card_bill, 600)
assert.equal(plan.budgets.find((row) => row.category === 'Outros').actual, 0)

const simulation = simulatePlannedPurchase({ item_name: 'Teste', amount: 200, category: 'Outros' }, state, new Date('2026-06-19T12:00:00'))
assert.equal(simulation.would_write_transaction, false)

const identity = normalizeProductIdentity('lanterna tras ld punto')
const offers = chooseBestCompatibleOffer([
  { title: 'Lanterna traseira direita Palio', total: 80 },
  { title: 'Lanterna traseira direita Fiat Punto', total: 230 },
], identity)
assert.equal(offers.status, 'found_compatible')
assert.equal(offers.best.total, 230)

const schemas = fs.readFileSync(path.join(root, 'supabase/functions/_shared/automations/schemas.js'), 'utf8')
for (const template of [
  'goal_progress_behind',
  'budget_category_above_limit',
  'monthly_plan_risk',
  'purchase_now_viable',
  'investment_capacity_available',
]) {
  assert.ok(schemas.includes(template), `Template de automacao ausente: ${template}`)
}

console.log('Planning validation: PASS')
