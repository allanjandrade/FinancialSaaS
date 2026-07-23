import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { ROUTE_META } from '../src/router/navigation.js'

const root = process.cwd()
const requiredFiles = [
  'src/domain/predictive/index.js',
  'src/views/Advisor.vue',
  'supabase/functions/_shared/predictive-engine/index.ts',
  'supabase/functions/predictive-snapshot/index.ts',
  'supabase/functions/scenario-simulation/index.ts',
  'supabase/functions/advisor-report/index.ts',
  'supabase/functions/advisor-feedback/index.ts',
  'supabase/migrations/20260620111500_release9_predictive_advisor.sql',
  'tests/unit/predictive-spending-forecast.test.js',
  'tests/unit/predictive-month-end-projection.test.js',
  'tests/unit/predictive-investment-capacity.test.js',
  'tests/unit/predictive-scenario-engine.test.js',
  'tests/unit/predictive-recommendation-engine.test.js',
  'tests/unit/advisor-context.test.js',
  'tests/unit/advisor-feedback.test.js',
  'cypress/e2e/release9-advisor.cy.js',
  'cypress/e2e/release9-scenarios.cy.js',
  'cypress/e2e/release9-dashboard-advisor-cards.cy.js',
]

for (const file of requiredFiles) {
  assert.ok(fs.existsSync(path.join(root, file)), `Arquivo obrigatorio ausente: ${file}`)
}

const nav = fs.readFileSync(path.join(root, 'src/router/navigation.js'), 'utf8')
assert.ok(nav.includes("path: '/advisor'"), 'Menu Consultor ausente')
assert.equal(ROUTE_META['/advisor']?.title, 'Consultor financeiro', 'Titulo do Consultor ausente')
assert.deepEqual(
  ROUTE_META['/advisor']?.breadcrumb,
  ['Intelig\u00eancia', 'Consultor financeiro'],
  'Breadcrumb do Consultor ausente',
)

const advisor = fs.readFileSync(path.join(root, 'src/views/Advisor.vue'), 'utf8')
for (const forbidden of ['WhatsApp', 'Gmail', 'Google Sheets', 'Open Finance', 'script livre']) {
  assert.equal(advisor.includes(forbidden), false, `Escopo proibido exposto na UI: ${forbidden}`)
}

const predictiveHaystack = [
  'supabase/functions/_shared/predictive-engine/http.ts',
  'supabase/functions/advisor-feedback/index.ts',
  'supabase/functions/predictive-snapshot/index.ts',
  'supabase/functions/scenario-simulation/index.ts',
  'supabase/functions/advisor-report/index.ts',
].map((file) => fs.readFileSync(path.join(root, file), 'utf8')).join('\n')

for (const event of [
  'predictive_snapshot_requested',
  'predictive_snapshot_generated',
  'scenario_simulation_requested',
  'scenario_simulation_generated',
  'advisor_report_requested',
  'advisor_report_generated',
  'advisor_feedback_recorded',
  'advisor_engine_failed',
  'advisor_context_sanitized',
]) {
  assert.ok(predictiveHaystack.includes(event), `Evento obrigatorio ausente: ${event}`)
}

console.log('Advisor validation: PASS')
