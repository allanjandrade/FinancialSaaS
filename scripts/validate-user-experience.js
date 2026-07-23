import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { buildDemoFinanceState, buildExecutiveSummary, getInitialSetupStatus } from '../src/utils/release7-ux.js'

const root = process.cwd()
const requiredFiles = [
  'src/views/Onboarding.vue',
  'src/components/onboarding/OnboardingStep.vue',
  'src/components/onboarding/OnboardingProgress.vue',
  'src/components/onboarding/OnboardingCompletion.vue',
  'src/components/ExecutiveHero.vue',
  'src/components/DemoModeDashboard.vue',
  'src/utils/release7-ux.js',
  'cypress/e2e/release7-user-experience.cy.js',
]

for (const file of requiredFiles) {
  assert.ok(fs.existsSync(path.join(root, file)), `Arquivo obrigatorio ausente: ${file}`)
}

const router = fs.readFileSync(path.join(root, 'src/router/index.js'), 'utf8')
for (const route of ['/onboarding', '/dashboard', '/entries', '/automations', '/operational']) {
  assert.ok(router.includes(route), `Rota principal ausente: ${route}`)
}

const home = fs.readFileSync(path.join(root, 'src/views/Home.vue'), 'utf8')
const onboarding = fs.readFileSync(path.join(root, 'src/views/Onboarding.vue'), 'utf8')
const onboardingCompletion = fs.readFileSync(path.join(root, 'src/components/onboarding/OnboardingCompletion.vue'), 'utf8')
const dashboard = fs.readFileSync(path.join(root, 'src/views/Home.vue'), 'utf8')
const demo = fs.readFileSync(path.join(root, 'src/components/DemoModeDashboard.vue'), 'utf8')
const entries = fs.readFileSync(path.join(root, 'src/views/Entries.vue'), 'utf8')

assert.ok(home.includes('Comece configurando sua vida financeira'))
assert.ok(onboarding.includes('Perfil financeiro basico'))
assert.ok(onboardingCompletion.includes('Seu financeiro inicial esta pronto.'))
assert.ok(dashboard.includes('Comece configurando sua vida financeira'))
assert.ok(entries.includes('Nenhum lançamento ainda'))
assert.ok(demo.includes('Modo demonstracao: estes dados sao ficticios e nao alteram sua conta.'))
assert.ok(!demo.includes('service_role'), 'Demo mode nao pode usar service role.')

const forbiddenVisibleCopy = ['REVERT_CONFLICT', 'Quota exceeded', 'payload', 'runner', 'dedupe']
for (const file of [
  'src/views/Onboarding.vue',
  'src/components/DemoModeDashboard.vue',
  'src/components/ExecutiveHero.vue',
  'src/components/EmptyState.vue',
]) {
  const content = fs.readFileSync(path.join(root, file), 'utf8')
  for (const term of forbiddenVisibleCopy) {
    assert.equal(content.includes(term), false, `${file} expoe termo tecnico: ${term}`)
  }
}

const demoState = buildDemoFinanceState()
const demoBefore = JSON.stringify(demoState)
const summary = buildExecutiveSummary(demoState, (month) => {
  const key = demoState.settings.year * 100 + month
  const monthKey = (date) => {
    const [year, rawMonth] = String(date).split('-').map(Number)
    return year * 100 + rawMonth
  }
  return {
    incomeCash: demoState.incomes.filter((item) => monthKey(item.date) === key && !['VA', 'VR'].includes(item.type)).reduce((sum, item) => sum + Number(item.amount || 0), 0),
    vaIncome: demoState.incomes.filter((item) => monthKey(item.date) === key && ['VA', 'VR'].includes(item.type)).reduce((sum, item) => sum + Number(item.amount || 0), 0),
    cashExpenses: demoState.expenses.filter((item) => monthKey(item.date) === key && !['Credito', 'VA', 'VR'].includes(item.payment)).reduce((sum, item) => sum + Number(item.amount || 0), 0),
    cardBill: demoState.expenses.filter((item) => monthKey(item.date) === key && item.payment === 'Credito').reduce((sum, item) => sum + Number(item.amount || 0), 0),
  }
})

assert.ok(summary.safeToSpend >= 0, 'Dashboard demo deve ter saldo seguro calculavel.')
assert.equal(JSON.stringify(demoState), demoBefore, 'Demo mode nao pode mutar estado financeiro.')

const status = getInitialSetupStatus({
  settings: { year: 2026, selectedMonth: 6 },
  incomes: [{ amount: 1 }],
  expenses: [{ amount: 1 }],
  financialAccounts: [{ balance: 1 }],
  creditCards: [],
  benefitWallets: [],
}, () => ({}))
assert.equal(status.percent, 100)

const migrationsDir = path.join(root, 'supabase/migrations')
const release7Migrations = fs.existsSync(migrationsDir)
  ? fs.readdirSync(migrationsDir).filter((file) => /release7/i.test(file))
  : []
assert.equal(release7Migrations.length, 0, 'Release 7 nao deve criar migration sem necessidade explicita.')

console.log('User experience validation: PASS')
