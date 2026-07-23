import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { normalizeProductIdentity } from '../src/utils/productIdentity.js'
import { chooseBestCompatibleOffer, scoreProductCandidate } from '../src/utils/productCandidateScoring.js'

const root = process.cwd()

function read(file) {
  return fs.readFileSync(path.join(root, file), 'utf8')
}

function exists(file) {
  return fs.existsSync(path.join(root, file))
}

assert.ok(exists('dist/index.html'), 'Build local ausente. Rode npm run build antes do smoke.')
assert.ok(exists('src/components/layout/PageShell.vue'), 'PageShell ausente.')
assert.ok(exists('src/components/layout/ResponsiveGrid.vue'), 'ResponsiveGrid ausente.')

const router = read('src/router/index.js')
const sidebar = read('src/components/Sidebar.vue')
const reports = read('src/views/Reports.vue')
const home = read('src/views/Home.vue')
const responsiveGrid = read('src/components/layout/ResponsiveGrid.vue')

for (const route of ['/plan', '/goals', '/budget', '/purchase-simulator', '/dashboard', '/reports']) {
  assert.ok(router.includes(route), `Rota canonica ausente: ${route}`)
}

for (const route of ['/goals', '/budget', '/purchase-simulator']) {
  assert.ok(sidebar.includes(route), `Menu nao aponta para a rota canonica ${route}`)
}

assert.equal(sidebar.includes('/plan#goals'), false, 'Metas nao pode depender de hash.')
assert.equal(sidebar.includes('/plan#budget'), false, 'Orcamento nao pode depender de hash.')
assert.equal(router.includes("redirect: '/dashboard?assistant=reports'"), false, 'Reports nao pode redirecionar para Dashboard.')

assert.ok(home.includes('ContextualAssistant context-type="dashboard"'), 'Dashboard precisa manter contexto dashboard.')
assert.ok(reports.includes('reports-period-filter'), 'Reports precisa manter filtro de periodo.')
assert.ok(reports.includes('reports-category-analysis'), 'Reports precisa manter analise por categoria.')
assert.ok(reports.includes('reports-trends'), 'Reports precisa manter tendencias historicas.')
assert.ok(reports.includes('ContextualAssistant context-type="reports"'), 'Reports precisa manter contexto reports.')
assert.ok(responsiveGrid.includes('auto-fit'), 'Grid responsivo precisa usar auto-fit.')
assert.ok(responsiveGrid.includes('@media (max-width: 520px)'), 'Grid responsivo precisa cobrir mobile estreito.')

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
  assert.equal(scoreProductCandidate(candidate, identity).compatible, false, `${candidate.title} nao pode ser aceito como compativel.`)
}

const best = chooseBestCompatibleOffer(candidates, identity)
assert.equal(best.status, 'found_compatible')
assert.equal(best.best_compatible_offer.total, 320)

console.info('Release 8 smoke local: PASS, navegacao, identidade de produto e layout corrigidos')
