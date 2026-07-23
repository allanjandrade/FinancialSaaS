import assert from 'node:assert/strict'
import { NAV_GROUPS } from '../src/router/navigation.js'

const labels = NAV_GROUPS.flatMap((group) => group.items.map((item) => item.label))
const paths = NAV_GROUPS.flatMap((group) => group.items.map((item) => item.path))
const items = NAV_GROUPS.flatMap((group) => group.items)
const groups = NAV_GROUPS.map((group) => [group.label, group.items.map((item) => item.label)])

assert.equal(new Set(paths).size, paths.length, 'Menu nao pode ter rotas duplicadas')
assert.deepEqual(groups, [
  ['Início', ['Comando']],
  ['Inteligência', ['Análises', 'Relatórios', 'Planejamento', 'Wishlist', 'Consultor']],
  ['Operação', ['Lançamentos', 'Contas', 'Cartões', 'Benefícios', 'Assinaturas', 'Família']],
  ['Configurações', ['Perfil', 'Segurança', 'Integrações', 'Admin', 'Operacional']],
])

for (const hiddenLabel of [
  'Dashboard',
  'Visão Geral',
  'Compras planejadas',
  'Simulações',
  'Ações inteligentes',
  'Alertas',
  'Metas',
  'Posso comprar?',
  'Histórico de ações',
]) {
  assert.equal(labels.includes(hiddenLabel), false, `${hiddenLabel} nao pode ser item principal`)
}

assert.equal(items.find((item) => item.path === '/admin')?.adminOnly, true, 'Admin deve ser visivel apenas para administradores')
assert.equal(items.find((item) => item.path === '/operational')?.operationalOnly, true, 'Operacional deve ser visivel apenas para owner/admin')

for (const hiddenPath of ['/purchase-simulator', '/simulations', '/ai-actions', '/automations', '/goals']) {
  assert.equal(paths.includes(hiddenPath), false, `Menu nao pode expor rota secundaria: ${hiddenPath}`)
}

console.log('Menu architecture validation: PASS')
