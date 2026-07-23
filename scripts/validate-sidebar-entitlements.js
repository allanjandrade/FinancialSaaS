import fs from 'node:fs'
import assert from 'node:assert/strict'
import { NAV_GROUPS } from '../src/router/navigation.js'
import { featureForPath } from '../src/domain/entitlements/featureAccess.js'

const sidebar = fs.readFileSync('src/components/Sidebar.vue', 'utf8')
const plans = fs.readFileSync('src/domain/billing/plans.js', 'utf8')
const edgeEntitlements = fs.readFileSync('supabase/functions/_shared/release10/entitlements.ts', 'utf8')
const migration = fs.readFileSync('supabase/migrations/20260621143000_release11_entitlements_hotfix.sql', 'utf8')
const menuItems = NAV_GROUPS.flatMap((group) => group.items)

assert.equal(menuItems.find((item) => item.path === '/advisor')?.premiumFeature, 'predictive_advisor', 'Consultor precisa de gate Premium no menu')
assert.equal(menuItems.some((item) => item.path === '/simulations'), false, 'Simulacoes ficam dentro de Planejamento, nao no menu principal')
assert.equal(menuItems.some((item) => item.path === '/ai-actions'), false, 'Acoes inteligentes ficam como rota contextual, nao no menu principal')
assert.equal(menuItems.some((item) => item.path === '/automations'), false, 'Alertas ficam como rota contextual, nao no menu principal')
assert.equal(featureForPath('/simulations'), 'scenario_simulation', 'Rota de simulacoes precisa mapear feature Premium')
assert.equal(featureForPath('/simulations/can-i-buy'), 'scenario_simulation', 'Rota can-i-buy precisa mapear feature Premium')
assert.equal(featureForPath('/purchase-simulator'), 'scenario_simulation', 'Alias de simulador precisa mapear feature Premium')
assert.equal(featureForPath('/ai-actions'), 'smart_actions', 'Rota de acoes inteligentes precisa mapear feature Premium')
assert.ok(sidebar.includes('isNavItemLocked'), 'Sidebar precisa calcular item bloqueado')
assert.ok(sidebar.includes('premium-chip'), 'Sidebar precisa indicar Premium visivel')
assert.ok(plans.includes('wishlist_items: 5'), 'Plano gratis precisa limitar wishlist em 5')
assert.ok(plans.includes('automations_active: 1'), 'Plano gratis precisa permitir 1 alerta ativo')
assert.ok(edgeEntitlements.includes('wishlist_items: 5'), 'Resolver Edge precisa alinhar wishlist gratis')
assert.ok(edgeEntitlements.includes('automations_active: 1'), 'Resolver Edge precisa alinhar alertas gratis')
assert.ok(migration.includes("('free', 'automations', 1, true)"), 'Migration precisa alinhar automations Free')

console.log('Sidebar entitlements validation: PASS')
