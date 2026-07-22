import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const files = {
  home: path.join(root, 'src/views/Home.vue'),
  grid: path.join(root, 'src/components/layout/DashboardGrid.vue'),
  assistant: path.join(root, 'src/components/ContextualAssistant.vue'),
  cypress: path.join(root, 'cypress/e2e/release8-dashboard-layout.cy.js'),
}

for (const [name, file] of Object.entries(files)) {
  assert.ok(fs.existsSync(file), `Arquivo de layout ausente: ${name}`)
}

const home = fs.readFileSync(files.home, 'utf8')
const grid = fs.readFileSync(files.grid, 'utf8')
const assistant = fs.readFileSync(files.assistant, 'utf8')
const cypress = fs.readFileSync(files.cypress, 'utf8')

for (const section of [
  'executive-hero',
  'balance-hero',
  'dashboard-kpis',
  'recent-entries',
  'category-summary',
  'month-plan',
  'dashboard-alerts',
  'budget-summary',
  'quick-entry',
  'goals-summary',
  'automation-summary',
  'dashboard-assistant',
]) {
  assert.ok(home.includes(`data-dashboard-section="${section}"`), `Secao sem contrato visual: ${section}`)
}

assert.ok(grid.includes('minmax(0, 7fr) minmax(300px, 3fr)'), 'DashboardGrid deve usar proporcao desktop aprovada.')
assert.ok(grid.includes('@media (max-width: 1023px)'), 'DashboardGrid deve cair para uma coluna em tablet/mobile.')
assert.ok(assistant.includes('compact'), 'Copiloto contextual precisa aceitar modo compacto no Dashboard.')
assert.ok(
  home.includes('<ContextualAssistant') && home.includes('class="dashboard-assistant"'),
  'Copiloto deve estar integrado ao grid do Dashboard.',
)
assert.ok(home.includes('compact data-dashboard-section="dashboard-assistant"'), 'Copiloto do Dashboard configurado deve usar modo compacto.')
assert.ok(cypress.includes('gap before'), 'Cypress precisa medir buracos verticais entre secoes.')
assert.ok(cypress.includes('aside continues after main'), 'Cypress precisa validar balanceamento das colunas.')

console.log('Layout contract validation: PASS')
