import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { getPlan } from '../src/domain/billing/plans.js'
import { resolveEntitlements } from '../src/domain/billing/entitlements.js'

const root = process.cwd()
for (const file of [
  'src/domain/billing/plans.js',
  'src/domain/billing/entitlements.js',
  'src/views/Billing.vue',
  'src/components/billing/PaywallCard.vue',
  'supabase/functions/billing-create-checkout/index.ts',
  'supabase/functions/billing-webhook/index.ts',
  'supabase/functions/billing-subscription-status/index.ts',
  'supabase/migrations/20260620120000_release10_billing_admin_testers.sql',
]) {
  assert.ok(fs.existsSync(path.join(root, file)), `Arquivo obrigatorio ausente: ${file}`)
}

assert.equal(getPlan('free').limits.price_search_monthly, 3)
assert.equal(resolveEntitlements({ subscription: { status: 'active', plan_code: 'premium_monthly' } }).features.predictive_advisor, true)
console.log('Billing validation: PASS')
