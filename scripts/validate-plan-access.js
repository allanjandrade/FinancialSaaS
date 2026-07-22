import assert from 'node:assert/strict'
import fs from 'node:fs'
import { getPlan, publicPlans } from '../src/domain/billing/plans.js'
import { resolveEntitlements } from '../src/domain/billing/entitlements.js'
import { featureForPath, hasFeatureAccess } from '../src/domain/entitlements/featureAccess.js'
import { resolveFrontendAccess } from '../src/domain/access-control.js'
import { NAV_GROUPS } from '../src/router/navigation.js'

const router = fs.readFileSync('src/router/index.js', 'utf8')
const sidebar = fs.readFileSync('src/components/Sidebar.vue', 'utf8')
const billing = fs.readFileSync('src/views/Billing.vue', 'utf8')
const reports = fs.readFileSync('src/views/Reports.vue', 'utf8')
const topbar = fs.readFileSync('src/components/Topbar.vue', 'utf8')
const edgeEntitlements = fs.readFileSync('supabase/functions/_shared/release10/entitlements.ts', 'utf8')
const featureGate = fs.readFileSync('supabase/functions/_shared/release10/feature-gate.ts', 'utf8')

assert.deepEqual(publicPlans().map((plan) => plan.code), ['free', 'premium_monthly', 'premium_annual'], 'Planos publicos precisam ser exatamente Gratis, Premium mensal e Premium anual.')

const freePlan = getPlan('free')
assert.equal(freePlan.limits.price_search_monthly, 3, 'Gratis precisa limitar busca de preco a 3/mes.')
assert.equal(freePlan.limits.wishlist_items, 5, 'Gratis precisa limitar wishlist a 5.')
assert.equal(freePlan.limits.automations_active, 1, 'Gratis precisa limitar alertas ativos a 1.')
for (const feature of ['predictive_advisor', 'advanced_reports', 'scenario_simulation', 'smart_actions', 'export_reports', 'advanced_price_history']) {
  assert.equal(freePlan.features[feature], false, `Gratis precisa bloquear ${feature}.`)
}
for (const feature of ['price_search', 'wishlist_items', 'automations']) {
  assert.equal(freePlan.features[feature], true, `Gratis precisa permitir ${feature} com limite.`)
}

const premiumPlan = getPlan('premium_monthly')
for (const feature of ['predictive_advisor', 'advanced_reports', 'scenario_simulation', 'smart_actions', 'export_reports', 'advanced_price_history']) {
  assert.equal(premiumPlan.features[feature], true, `Premium precisa liberar ${feature}.`)
}

const freeEntitlements = resolveEntitlements({ subscription: { status: 'free', plan_code: 'free' } })
const freeAccess = resolveFrontendAccess({ entitlements: freeEntitlements })
for (const feature of ['predictive_advisor', 'scenario_simulation', 'smart_actions', 'export_reports', 'advanced_reports']) {
  assert.equal(hasFeatureAccess(freeAccess, feature), false, `Frontend precisa bloquear ${feature} no Gratis.`)
}

assert.equal(featureForPath('/advisor'), 'predictive_advisor')
assert.equal(featureForPath('/simulations/can-i-buy'), 'scenario_simulation')
assert.equal(featureForPath('/ai-actions'), 'smart_actions')
assert.ok(router.includes('resolveRouteFeatureAccess'), 'Router precisa aplicar guard de recursos Premium.')
const menuItems = NAV_GROUPS.flatMap((group) => group.items)
const menuPaths = menuItems.map((item) => item.path)
assert.equal(menuItems.find((item) => item.path === '/advisor')?.premiumFeature, 'predictive_advisor', 'Menu precisa bloquear Consultor para Gratis.')
assert.equal(menuPaths.includes('/simulations'), false, 'Simulacoes ficam bloqueadas pelo guard de rota, nao como item principal.')
assert.equal(menuPaths.includes('/ai-actions'), false, 'Acoes inteligentes ficam bloqueadas pelo guard de rota, nao como item principal.')
assert.equal(menuPaths.includes('/automations'), false, 'Alertas ficam fora do menu principal.')
assert.ok(sidebar.includes('isNavItemLocked'), 'Sidebar precisa exibir itens Premium bloqueados.')
assert.ok(billing.includes('locked-feature-message'), 'Billing precisa explicar recurso bloqueado.')
assert.ok(reports.includes("planAccess.canUse('advanced_reports')"), 'Relatorios avancados precisam consultar plano.')
assert.ok(reports.includes("planAccess.canUse('export_reports')"), 'Exportacao de relatorio precisa consultar plano.')
assert.ok(topbar.includes("planAccess.canUse('export_reports')"), 'Exportacao global precisa consultar plano.')

for (const edgeTerm of [
  'predictive_advisor: false',
  'scenario_simulation: false',
  'advanced_reports: false',
  'smart_actions: false',
  'export_reports: false',
  'advanced_price_history: false',
  'price_search_monthly: 3',
  'wishlist_items: 5',
  'automations_active: 1',
]) {
  assert.ok(edgeEntitlements.includes(edgeTerm), `Resolver Edge sem regra Free: ${edgeTerm}`)
}
assert.ok(featureGate.includes('FEATURE_NOT_ALLOWED'), 'Edge precisa rejeitar recurso Premium sem entitlement.')

console.log('Plan access validation: PASS')
