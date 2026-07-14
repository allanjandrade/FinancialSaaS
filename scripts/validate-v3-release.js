import assert from 'node:assert/strict'
import fs from 'node:fs'

const read = (file) => fs.readFileSync(file, 'utf8')
const exists = (file) => fs.existsSync(file)

const pkg = JSON.parse(read('package.json'))
const lock = JSON.parse(read('package-lock.json'))
const currentVersion = '3.2.0'

assert.equal(pkg.version, currentVersion, `package.json must declare ${currentVersion}.`)
assert.equal(lock.version, currentVersion, `package-lock root must declare ${currentVersion}.`)
assert.equal(lock.packages[''].version, currentVersion, `package-lock root package must declare ${currentVersion}.`)
assert.equal(
  pkg.scripts['validate:v3-release'],
  'node scripts/validate-v3-release.js',
  'validate:v3-release script is missing.'
)

assert.ok(exists('src/config/app-version.js'), 'Runtime version config is missing.')
const versionConfig = read('src/config/app-version.js')
for (const token of [
  `APP_VERSION = '${currentVersion}'`,
  "APP_RELEASE_CHANNEL = 'stable'",
  "APP_RELEASE_DATE = '2026-07-14'",
]) {
  assert.ok(versionConfig.includes(token), `Runtime version config is missing ${token}.`)
}

const settings = read('src/views/Settings.vue')
assert.ok(settings.includes("from '@/config/app-version.js'"), 'Settings must import runtime version config.')
assert.ok(settings.includes('data-testid="settings-app-version"'), 'Settings must expose a testable app version row.')
assert.ok(settings.includes('{{ APP_VERSION }}'), 'Settings must render APP_VERSION.')
assert.equal(settings.includes('<span>2.0.0</span>'), false, 'Settings must not keep the 2.0.0 hardcoded value.')

assert.ok(exists('src/domain/v3/commandCenter.js'), 'V3 command center domain module is missing.')
assert.ok(read('src/domain/v3/commandCenter.js').includes('buildV3CommandCenter'), 'V3 command center builder is missing.')
assert.ok(read('src/domain/v3/commandCenter.js').includes('buildV3FinancialScore'), 'V3 financial score builder is missing.')
assert.ok(read('src/domain/v3/commandCenter.js').includes('buildV3ActionPlan'), 'V3 action plan builder is missing.')
assert.ok(read('src/domain/v3/commandCenter.js').includes('v3CommandFactsForAI'), 'V3 AI facts builder is missing.')
assert.ok(exists('src/domain/v3/financialOperatingSystem.js'), 'V3 financial operating-system domain module is missing.')
assert.ok(read('src/domain/v3/financialOperatingSystem.js').includes('buildV3OperatingSystem'), 'V3 operating-system builder is missing.')
assert.ok(exists('src/components/v3/FinancialOSMap.vue'), 'V3 operating-system map component is missing.')
assert.ok(read('src/components/v3/FinancialOSMap.vue').includes('data-testid="v3-operating-system-map"'), 'V3 operating-system map test id is missing.')
assert.ok(exists('src/views/CommandCenter.vue'), 'V3 command center view is missing.')
const commandCenterView = read('src/views/CommandCenter.vue')
for (const token of [
  'data-testid="command-center-page"',
  'data-testid="v3-financial-score"',
  'data-testid="v3-operating-system-map"',
  'data-testid="v3-action-plan"',
  'data-testid="v3-execution-rails"',
  "import FinancialOSMap from '@/components/v3/FinancialOSMap.vue'",
  "import { buildV3OperatingSystem } from '@/domain/v3/financialOperatingSystem.js'",
  'v3CommandFactsForAI',
]) {
  assert.ok(commandCenterView.includes(token), `Command center view is missing ${token}.`)
}
const router = read('src/router/index.js')
const fallback = read('scripts/generate-spa-route-fallbacks.js')
assert.ok(router.includes("path: '/dashboard'"), 'Router must expose /dashboard.')
assert.ok(router.includes("name: 'dashboard'"), 'Dashboard route name is missing.')
assert.ok(router.includes("path: '/analysis'"), 'Router must expose /analysis.')
assert.ok(router.includes("component: () => import('@/views/Home.vue')"), 'Analysis route must load the old analytical dashboard.')
assert.ok(router.includes("path: '/command-center'"), 'Router must expose /command-center.')
assert.ok(router.includes("component: () => import('@/views/CommandCenter.vue')"), 'Router must load CommandCenter.vue.')
assert.ok(fallback.includes("'/command-center'"), 'SPA fallback must include /command-center.')
assert.ok(fallback.includes("'/analysis'"), 'SPA fallback must include /analysis.')
const navigation = read('src/router/navigation.js')
assert.ok(navigation.includes("{ path: '/dashboard', label: 'Comando', icon: 'commandCenter' }"), 'Navigation must promote /dashboard as command center.')
assert.ok(navigation.includes("{ path: '/analysis', label: 'Análises', icon: 'dashboard' }"), 'Navigation must expose analytical dashboard under intelligence.')
const analyst = read('src/api/financial-analyst.js')
assert.ok(analyst.includes("import { v3CommandFactsForAI } from '@/domain/v3/commandCenter.js'"), 'Financial analyst must import V3 command facts.')
assert.ok(analyst.includes('v3Command: commandCenter ? v3CommandFactsForAI(commandCenter) : null'), 'Financial analyst must send V3 command facts.')
const intelligenceCenter = read('src/views/IntelligenceCenter.vue')
assert.ok(intelligenceCenter.includes("import { buildV3CommandCenter } from '@/domain/v3/commandCenter.js'"), 'Intelligence center must build the V3 command center.')
assert.ok(intelligenceCenter.includes('commandCenter: v3Command.value'), 'Intelligence center must pass V3 command facts to AI.')

assert.ok(exists('src/domain/reconciliation/reconciliationEngine.js'), 'Reconciliation engine domain module is missing.')
const reconciliationEngine = read('src/domain/reconciliation/reconciliationEngine.js')
for (const token of [
  'buildStatementImportPreview',
  'detectStatementDuplicate',
  'suggestEntryClassification',
  'reconcileSubscriptionCharge',
]) {
  assert.ok(reconciliationEngine.includes(token), `Reconciliation engine is missing ${token}.`)
}
const financeStore = read('src/stores/finance.js')
for (const token of [
  'importSessions',
  'buildStatementImportPreview',
  'confirmStatementImportPreview',
  'rollbackImportSession',
]) {
  assert.ok(financeStore.includes(token), `Finance store is missing ${token}.`)
}
const entriesView = read('src/views/Entries.vue')
for (const token of [
  'data-testid="statement-import-summary"',
  'statementActionLabel',
  'confirmStatementImportPreview',
]) {
  assert.ok(entriesView.includes(token), `Entries view is missing ${token}.`)
}

assert.ok(exists('CHANGELOG.md'), 'CHANGELOG.md is missing.')
assert.ok(read('CHANGELOG.md').includes('## 3.2.0 - 2026-07-14'), 'CHANGELOG.md is missing the 3.2.0 entry.')
assert.ok(read('CHANGELOG.md').includes('## 3.1.0 - 2026-07-13'), 'CHANGELOG.md is missing the 3.1.0 entry.')
assert.ok(read('CHANGELOG.md').includes('## 3.0.0 - 2026-07-13'), 'CHANGELOG.md is missing the 3.0.0 entry.')

assert.ok(exists('docs/releases/RELEASE3_0_0.md'), 'Release 3.0.0 document is missing.')
assert.ok(
  read('docs/releases/RELEASE3_0_0.md').includes('# Release 3.0.0 - Product Readiness'),
  'Release 3.0.0 document has the wrong heading.'
)
assert.ok(exists('docs/releases/RELEASE3_1_0.md'), 'Release 3.1.0 document is missing.')
assert.ok(
  read('docs/releases/RELEASE3_1_0.md').includes('# Release 3.1.0 - Motor de Entrada e Conciliação'),
  'Release 3.1.0 document has the wrong heading.'
)
assert.ok(exists('docs/releases/RELEASE3_2_0.md'), 'Release 3.2.0 document is missing.')
assert.ok(
  read('docs/releases/RELEASE3_2_0.md').includes('# Release 3.2.0 - UX Operacional Integrado'),
  'Release 3.2.0 document has the wrong heading.'
)

const readme = read('README.md')
assert.ok(readme.includes(`Versão atual: ${currentVersion}`), 'README.md is missing the current version.')
assert.ok(readme.includes('npm run validate:v3-release'), 'README.md is missing the v3 validator command.')

console.log(`Version ${currentVersion} validation: PASS`)
