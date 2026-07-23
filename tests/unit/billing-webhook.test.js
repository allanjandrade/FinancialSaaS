import { describe, expect, it } from 'vitest'
import { processBillingWebhook, simpleHmac, validateWebhookSignature } from '@/domain/billing/webhook.js'

describe('Release 10 billing webhook', () => {
  it('rejects invalid signature and processes valid events idempotently', () => {
    const body = '{"event_id":"evt_1"}'
    expect(validateWebhookSignature({ body, signature: 'bad', secret: 'secret' })).toBe(false)
    expect(validateWebhookSignature({ body, signature: simpleHmac(body, 'secret'), secret: 'secret' })).toBe(true)

    const event = { event_id: 'evt_1', type: 'subscription_created', plan_code: 'premium_monthly', status: 'active', gateway_payload: { raw: true } }
    expect(processBillingWebhook(event).subscription.status).toBe('active')
    expect(processBillingWebhook(event, new Set(['evt_1'])).duplicated).toBe(true)
  })
})
