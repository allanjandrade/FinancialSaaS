import assert from 'node:assert/strict'
import { resolveFrontendAccess } from '../src/domain/access-control.js'
import { resolveEntitlements } from '../src/domain/billing/entitlements.js'
import { featureForPath, hasFeatureAccess } from '../src/domain/entitlements/featureAccess.js'

const free = resolveFrontendAccess({
  entitlements: resolveEntitlements({ subscription: { status: 'free', plan_code: 'free' } }),
})
const premium = resolveFrontendAccess({
  entitlements: resolveEntitlements({ subscription: { status: 'active', plan_code: 'premium_monthly' } }),
})

assert.equal(hasFeatureAccess(free, 'scenario_simulation'), false)
assert.equal(hasFeatureAccess(free, 'predictive_advisor'), false)
assert.equal(hasFeatureAccess(free, 'smart_actions'), false)
assert.equal(hasFeatureAccess(free, 'automations'), true)
assert.equal(free.limits.automations_active, 1)
assert.equal(free.limits.wishlist_items, 5)
assert.equal(hasFeatureAccess(premium, 'scenario_simulation'), true)
assert.equal(featureForPath('/simulations/can-i-buy'), 'scenario_simulation')
assert.equal(featureForPath('/ai-actions'), 'smart_actions')

console.log('Security plan access smoke: PASS')
