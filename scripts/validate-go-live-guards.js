import assert from 'node:assert/strict'
import { canAccessCheckout, canSeeNavItem, resolveFrontendAccess } from '../src/domain/access-control.js'
import { isMaintenanceBlocked, resolveBillingCheckoutMode } from '../src/domain/production-go-live.js'

const common = resolveFrontendAccess({ entitlements: { plan_code: 'free', is_tester: false } })
const tester = resolveFrontendAccess({ entitlements: { plan_code: 'free', is_tester: true } })
const owner = resolveFrontendAccess({ admin: { is_admin: true, role: 'owner' } })
const support = resolveFrontendAccess({ admin: { is_admin: true, role: 'support' } })

assert.equal(resolveBillingCheckoutMode(), 'testers_only')
assert.equal(canAccessCheckout(common, 'testers_only'), false)
assert.equal(canAccessCheckout(tester, 'testers_only'), true)
assert.equal(canSeeNavItem({ adminOnly: true }, common), false)
assert.equal(canSeeNavItem({ operationalOnly: true }, support), false)
assert.equal(canSeeNavItem({ operationalOnly: true }, owner), true)
assert.equal(isMaintenanceBlocked({ maintenanceMode: true, essential: false }), true)
assert.equal(isMaintenanceBlocked({ maintenanceMode: true, essential: true }), false)

console.log('Go-live guards validation: PASS')
