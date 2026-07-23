import assert from 'node:assert/strict'
import fs from 'node:fs'
import { canAccessCheckout, resolveFrontendAccess } from '../src/domain/access-control.js'
import { isMaintenanceBlocked, sanitizeHealthCheckPayload } from '../src/domain/production-go-live.js'

for (const file of [
  'src/views/public/Landing.vue',
  'src/views/public/Pricing.vue',
  'src/views/legal/PrivacyPolicy.vue',
  'src/views/legal/TermsOfUse.vue',
  'src/views/Billing.vue',
  'src/views/Admin.vue',
  'src/views/Operational.vue',
]) {
  assert.ok(fs.existsSync(file), `Arquivo obrigatorio ausente: ${file}`)
}

const common = resolveFrontendAccess({ entitlements: { plan_code: 'free', is_tester: false } })
const tester = resolveFrontendAccess({ entitlements: { plan_code: 'free', is_tester: true } })
assert.equal(canAccessCheckout(common, 'testers_only'), false)
assert.equal(canAccessCheckout(tester, 'testers_only'), true)
assert.equal(isMaintenanceBlocked({ maintenanceMode: true, essential: false }), true)
assert.equal(sanitizeHealthCheckPayload({ status: 'ok', checks: { db: 'ok' } }).status, 'ok')

console.log('Release 11 smoke local: PASS, go-live controlado validado')
