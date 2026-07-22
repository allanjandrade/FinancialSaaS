import assert from 'node:assert/strict'
import fs from 'node:fs'
import { resolveEntitlements } from '../src/domain/billing/entitlements.js'

const resolved = resolveEntitlements({
  subscription: { status: 'free', plan_code: 'free' },
  tester: { status: 'active', access_expires_at: '2026-07-20T00:00:00Z' },
  overrides: [{ feature_key: 'predictive_advisor', enabled: false, expires_at: '2026-07-01T00:00:00Z' }],
}, new Date('2026-06-20T00:00:00Z'))
assert.equal(resolved.features.predictive_advisor, false)
assert.ok(fs.existsSync('supabase/functions/entitlements-resolve/index.ts'))
console.log('Entitlements validation: PASS')
