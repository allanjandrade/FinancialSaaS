import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import {
  normalizeProductIdentity,
} from '../src/utils/productIdentity.js'
import {
  chooseBestCompatibleOffer,
  scoreProductCandidate,
} from '../src/utils/productCandidateScoring.js'

const root = process.cwd()
const requiredFiles = [
  'src/components/layout/PageShell.vue',
  'src/components/layout/PageHeader.vue',
  'src/components/layout/Breadcrumb.vue',
  'src/components/layout/ResponsiveGrid.vue',
  'src/components/layout/DashboardGrid.vue',
  'src/router/navigation.js',
  'src/views/Plan.vue',
  'src/views/Goals.vue',
  'src/views/Budget.vue',
  'src/views/PurchaseSimulator.vue',
  'src/views/Reports.vue',
  'src/utils/productIdentity.js',
  'src/utils/productCandidateScoring.js',
  'tests/unit/product-identity.test.js',
  'tests/unit/product-candidate-scoring.test.js',
  'tests/unit/price-search-compatibility.test.js',
  'tests/unit/wishlist-compatible-price.test.js',
  'tests/unit/purchase-intelligence-compatible-price.test.js',
  'tests/unit/wishlist-target-price-automation.test.js',
  'tests/unit/release8-navigation.test.js',
  'tests/unit/release8-dashboard-reports.test.js',
  'tests/unit/release8-layout-contract.test.js',
  'scripts/validate-layout-contract.js',
  'scripts/validate-navigation.js',
  'scripts/validate-valueserp-price-search.js',
  'scripts/validate-production-readiness.js',
  'scripts/validate-rls-security.js',
  'scripts/validate-secrets-exposure.js',
  'scripts/release8-final-product-match-smoke.js',
  'scripts/release8-final-authenticated-smoke.js',
  'scripts/release8-dashboard-layout-smoke.js',
  'scripts/release8-dashboard-layout-remote-smoke.js',
  'scripts/release8-navigation-smoke.js',
  'scripts/release8-navigation-remote-smoke.js',
  'cypress/e2e/release8-navigation.cy.js',
  'cypress/e2e/release8-product-identity.cy.js',
  'cypress/e2e/release8-product-identity-real-flow.cy.js',
  'cypress/e2e/release8-dashboard-reports.cy.js',
  'cypress/e2e/release8-dashboard-layout.cy.js',
  'cypress/e2e/release8-navigation-professional.cy.js',
  'cypress/e2e/release8-valueserp-price-search.cy.js',
  'cypress/e2e/release8-final-wishlist-real-flow.cy.js',
  'cypress/e2e/release8-production-readiness.cy.js',
  'cypress/e2e/release8-responsive-layout.cy.js',
  'docs/compliance/LGPD_DOSSIER.md',
  'docs/compliance/LGPD_RELEASE8_EVIDENCE.md',
  'docs/uat/RELEASE8_P0_UAT_EVIDENCE.md',
  'docs/releases/RELEASE8_FINAL_CLOSEOUT.md',
]

for (const file of requiredFiles) {
  assert.ok(fs.existsSync(path.join(root, file)), `Arquivo obrigatorio ausente: ${file}`)
}

const router = fs.readFileSync(path.join(root, 'src/router/index.js'), 'utf8')
const sidebar = fs.readFileSync(path.join(root, 'src/components/Sidebar.vue'), 'utf8')
const navigation = fs.readFileSync(path.join(root, 'src/router/navigation.js'), 'utf8')
for (const route of ['/plan', '/goals', '/budget', '/purchase-simulator', '/reports', '/dashboard']) {
  assert.ok(router.includes(route), `Rota critica ausente: ${route}`)
}
for (const route of ['/goals', '/budget', '/purchase-simulator']) {
  assert.ok(navigation.includes(route), `Menu critico ausente: ${route}`)
}
assert.ok(sidebar.includes('NAV_GROUPS'), 'Sidebar deve consumir a navegacao centralizada.')
assert.equal(navigation.includes('/plan#goals'), false, 'Menu nao pode depender de hash para Metas.')
assert.equal(navigation.includes('/plan#budget'), false, 'Menu nao pode depender de hash para Orcamento.')
assert.equal(router.includes("redirect: '/dashboard?assistant=reports'"), false, 'Reports nao pode redirecionar para Dashboard.')

const home = fs.readFileSync(path.join(root, 'src/views/Home.vue'), 'utf8')
const hero = fs.readFileSync(path.join(root, 'src/components/ExecutiveHero.vue'), 'utf8')
const reports = fs.readFileSync(path.join(root, 'src/views/Reports.vue'), 'utf8')
assert.ok(hero.includes('Como estou agora?'), 'Dashboard precisa ser cockpit do agora.')
assert.ok(hero.includes('Próxima melhor ação'), 'Dashboard precisa ter próxima ação.')
assert.ok(home.includes('ContextualAssistant context-type="dashboard"'), 'Dashboard precisa manter assistente em contexto dashboard.')
assert.ok(reports.includes('reports-period-filter'), 'Relatorios precisam de filtro de periodo.')
assert.ok(reports.includes('reports-category-analysis'), 'Relatorios precisam de analise por categoria.')
assert.ok(reports.includes('reports-trends'), 'Relatorios precisam de evolucao temporal.')

const identity = normalizeProductIdentity('lanterna tras ld punto')
assert.deepEqual(identity.must_match_terms, ['lanterna', 'traseira', 'punto', 'direita'])
assert.equal(identity.side_required, true)
const candidates = [
  { title: 'Lanterna Traseira Siena Tampa Magneti Marelli', total: 110.25 },
  { title: 'Lanterna Traseira Hilux 2012/2015 Direita', total: 252.68 },
  { title: 'Lanterna Mala Direito Grand Siena', total: 209.61 },
  { title: 'Magneti Marelli Lanterna Fiat Palio Weekend', total: 213.21 },
  { title: 'Lanterna Fiat Palio Adventure', total: 229.77 },
  { title: 'Lanterna Traseira Direita Fiat Punto 2008 2009', total: 320 },
]
assert.equal(scoreProductCandidate(candidates[5], identity).compatible, true)
for (const candidate of candidates.slice(0, 5)) {
  assert.equal(scoreProductCandidate(candidate, identity).compatible, false, `${candidate.title} nao pode ser compativel.`)
}
const best = chooseBestCompatibleOffer(candidates, identity)
assert.equal(best.status, 'found_compatible')
assert.equal(best.best_compatible_offer.total, 320)

const planner = fs.readFileSync(path.join(root, 'src/views/Planner.vue'), 'utf8')
const wishlist = fs.readFileSync(path.join(root, 'src/views/PurchaseWishlist.vue'), 'utf8')
assert.equal(planner.includes('Melhor preço encontrado'), false)
assert.equal(planner.includes('Melhor preco encontrado'), false)
assert.equal(wishlist.includes('Melhor preço encontrado'), false)

const responsiveGrid = fs.readFileSync(path.join(root, 'src/components/layout/ResponsiveGrid.vue'), 'utf8')
assert.ok(responsiveGrid.includes('auto-fit'), 'ResponsiveGrid de acoes deve usar auto-fit.')
assert.ok(responsiveGrid.includes('@media (max-width: 520px)'), 'ResponsiveGrid deve cobrir mobile estreito.')

console.log('Release 8 core validation: PASS')
