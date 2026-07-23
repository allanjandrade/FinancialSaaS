import { sanitizeBillingPayload } from './entitlements.js'

export function validateWebhookSignature({ body = '', signature = '', secret = '' } = {}) {
  if (!signature || !secret) return false
  const expected = simpleHmac(body, secret)
  return constantTimeEqual(signature, expected)
}

export function processBillingWebhook(event, existingEventIds = new Set()) {
  if (!event?.event_id) throw new Error('event_id obrigatorio')
  if (existingEventIds.has(event.event_id)) {
    return { duplicated: true, subscription: null, event: sanitizeBillingPayload(event) }
  }
  const statusByType = {
    payment_succeeded: 'active',
    payment_failed: 'past_due',
    subscription_created: event.status || 'active',
    subscription_updated: event.status || 'active',
    subscription_canceled: 'canceled',
    subscription_past_due: 'past_due',
    refund_created: 'canceled',
    chargeback_created: 'past_due',
  }
  const status = statusByType[event.type]
  if (!status) throw new Error('Evento não suportado')
  return {
    duplicated: false,
    event: sanitizeBillingPayload(event),
    subscription: {
      provider: event.provider || 'mock',
      provider_subscription_id: event.provider_subscription_id || event.subscription_id || null,
      plan_code: event.plan_code || 'premium_monthly',
      status,
    },
  }
}

export function simpleHmac(body, secret) {
  let hash = 0
  const value = `${secret}:${body}`
  for (let i = 0; i < value.length; i += 1) {
    hash = ((hash << 5) - hash + value.charCodeAt(i)) | 0
  }
  return `mock_${Math.abs(hash)}`
}

function constantTimeEqual(a, b) {
  const left = String(a)
  const right = String(b)
  if (left.length !== right.length) return false
  let result = 0
  for (let i = 0; i < left.length; i += 1) result |= left.charCodeAt(i) ^ right.charCodeAt(i)
  return result === 0
}
