import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { NAV_GROUPS, ROUTE_META, isItemActive, metaForPath } from '../src/router/navigation.js'

const root = process.cwd()
const files = {
  sidebar: path.join(root, 'src/components/Sidebar.vue'),
  breadcrumb: path.join(root, 'src/components/layout/Breadcrumb.vue'),
  pageHeader: path.join(root, 'src/components/layout/PageHeader.vue'),
  router: path.join(root, 'src/router/index.js'),
  cypress: path.join(root, 'cypress/e2e/release8-navigation-professional.cy.js'),
}

for (const [name, file] of Object.entries(files)) {
  assert.ok(fs.existsSync(file), `Arquivo de navegacao ausente: ${name}`)
}

const sidebar = fs.readFileSync(files.sidebar, 'utf8')
const router = fs.readFileSync(files.router, 'utf8')
const cypress = fs.readFileSync(files.cypress, 'utf8')

const requiredRoutes = [
  '/dashboard',
  '/analysis',
  '/reports',
  '/entries',
  '/accounts',
  '/cards',
  '/benefits',
  '/structure',
  '/card',
  '/benefit',
  '/plan',
  '/goals',
  '/budget',
  '/purchases',
  '/simulations',
  '/simulations/can-i-buy',
  '/purchase-simulator',
  '/automations',
  '/ai',
  '/ai-actions',
  '/advisor',
  '/settings',
  '/family',
  '/billing',
  '/support',
  '/operational',
]

for (const route of requiredRoutes) {
  assert.ok(ROUTE_META[route], `Rota critica sem metadata: ${route}`)
  assert.ok(ROUTE_META[route].title, `Rota critica sem titulo: ${route}`)
  assert.ok(ROUTE_META[route].group, `Rota critica sem grupo: ${route}`)
  assert.ok(ROUTE_META[route].breadcrumb?.length >= 2, `Rota critica sem breadcrumb: ${route}`)
}

const requiredLabels = [
  'Comando',
  'An\u00e1lises',
  'Lan\u00e7amentos',
  'Contas',
  'Cart\u00f5es',
  'Benef\u00edcios',
  'Relat\u00f3rios',
  'Planejamento',
  'Wishlist',
  'Consultor',
  'Perfil',
  'Fam\u00edlia',
  'Seguran\u00e7a',
  'Integra\u00e7\u00f5es',
  'Admin',
  'Operacional',
]
const menuLabels = NAV_GROUPS.flatMap((group) => group.items.map((item) => item.label))
const menuItems = NAV_GROUPS.flatMap((group) => group.items)
for (const label of requiredLabels) {
  assert.ok(menuLabels.includes(label), `Label obrigatorio ausente no menu: ${label}`)
}

assert.equal(menuLabels.includes('Posso comprar?'), false, 'Posso comprar deve ficar dentro de Simulacoes.')
assert.equal(menuLabels.includes('Hist\u00f3rico de a\u00e7\u00f5es'), false, 'Historico de acoes nao deve ser menu principal.')
assert.equal(menuLabels.includes('Dashboard'), false, 'Dashboard deve aparecer como Visao Geral.')
assert.equal(menuLabels.includes('Vis\u00e3o Geral'), false, 'Visao Geral antiga deve ficar dentro de Analises.')
assert.equal(menuLabels.includes('Compras planejadas'), false, 'Compras planejadas deve aparecer como Wishlist.')
assert.equal(menuLabels.includes('Simula\u00e7\u00f5es'), false, 'Simulacoes nao deve competir com Planejamento no menu principal.')
assert.equal(menuLabels.includes('Metas'), false, 'Metas deve ficar dentro de Planejamento.')
assert.equal(menuLabels.includes('A\u00e7\u00f5es inteligentes'), false, 'Acoes inteligentes devem ficar como rota contextual.')
assert.equal(menuLabels.includes('Alertas'), false, 'Alertas devem ficar como rota contextual.')
assert.equal(menuLabels.includes('Plano do m\u00eas'), false, 'Plano do mes nao deve voltar ao menu principal.')
assert.equal(menuLabels.includes('Or\u00e7amento'), false, 'Orcamento nao deve voltar ao menu principal.')
assert.equal(menuItems.find((item) => item.path === '/admin')?.adminOnly, true, 'Admin deve ser item condicional administrativo.')
assert.equal(menuItems.find((item) => item.path === '/operational')?.operationalOnly, true, 'Operacional deve ser item condicional owner/admin.')

for (const group of ['In\u00edcio', 'Opera\u00e7\u00e3o', 'Intelig\u00eancia', 'Configura\u00e7\u00f5es']) {
  assert.ok(NAV_GROUPS.some((item) => item.label === group), `Grupo ausente: ${group}`)
}

assert.deepEqual(metaForPath('/purchases/produto').breadcrumb, ['Intelig\u00eancia', 'Wishlist', 'Produto'])
assert.equal(isItemActive('/purchases/produto', '/purchases'), true)
assert.equal(isItemActive('/simulations/can-i-buy', '/plan'), true)
assert.equal(isItemActive('/purchase-simulator', '/plan'), true)
assert.ok(sidebar.includes('nav-tooltip'), 'Sidebar colapsada precisa renderizar tooltips.')
assert.ok(sidebar.includes('Expandir menu'), 'Botao inferior precisa ter funcao explicita de expandir.')
assert.ok(sidebar.includes('Recolher menu'), 'Botao inferior precisa ter funcao explicita de recolher.')
assert.ok(sidebar.includes('mobile-bottom-nav'), 'Mobile precisa usar bottom navigation.')
assert.ok(sidebar.includes('mobile-more-drawer'), 'Mobile precisa ter drawer Mais.')
assert.ok(sidebar.includes('premium-chip'), 'Itens Premium precisam permanecer visiveis com trava no menu.')
assert.ok(router.includes("path: '/compras-ia/produto/:id'") && router.includes("`/purchases/${to.params.id}`"), 'Alias legado de produto deve redirecionar para rota canonica.')
assert.ok(router.includes("path: '/purchases/:id'"), 'Rota canonica de produto ausente.')
assert.ok(router.includes("path: '/simulations/can-i-buy'"), 'Rota canonica Posso comprar ausente dentro de Simulacoes.')
assert.ok(cypress.includes('Release 8.3 professional navigation'), 'Cypress profissional de navegacao ausente.')

console.log('Navigation validation: PASS')
