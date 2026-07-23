import assert from 'node:assert/strict'
import { resolveEntitlements, canUseFeature } from '../src/domain/billing/entitlements.js'
import { processBillingWebhook, simpleHmac, validateWebhookSignature } from '../src/domain/billing/webhook.js'

const free = resolveEntitlements({ subscription: { status: 'free', plan_code: 'free' } })
const premium = resolveEntitlements({ subscription: { status: 'active', plan_code: 'premium_monthly' } })
assert.equal(free.plan_code, 'free')
assert.equal(premium.features.predictive_advisor, true)
assert.equal(canUseFeature(free, 'price_search', 3).reason, 'LIMIT_EXCEEDED')
assert.equal(validateWebhookSignature({ body: '{}', signature: 'bad', secret: 'secret' }), false)
assert.equal(validateWebhookSignature({ body: '{}', signature: simpleHmac('{}', 'secret'), secret: 'secret' }), true)
assert.equal(processBillingWebhook({ event_id: 'evt-1', type: 'subscription_canceled', plan_code: 'premium_monthly' }).subscription.status, 'canceled')
console.log('Release 10 local smoke: PASS')
