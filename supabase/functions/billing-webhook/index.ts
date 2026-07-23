import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { corsHeaders, jsonResponse } from '../_shared/cors.ts'
import { sanitizeMetadata, serviceRestRequest } from '../_shared/release10/rest.ts'

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  const signature = req.headers.get('x-billing-signature') || ''
  const secret = Deno.env.get('BILLING_WEBHOOK_SECRET') || 'local-release10-secret'
  const text = await req.text()
  if (!signature || signature !== `mock_${secret}`) {
    return jsonResponse({ error: { code: 'INVALID_WEBHOOK_SIGNATURE', message: 'Webhook invalido.' } }, 403)
  }
  const event = JSON.parse(text || '{}')
  const existing = await serviceRestRequest(`billing_events?select=id&provider=eq.${encodeURIComponent(event.provider || 'mock')}&event_id=eq.${encodeURIComponent(event.event_id)}&limit=1`) as any[]
  if (existing?.[0]) return jsonResponse({ duplicated: true })
  await serviceRestRequest('billing_events', {
    method: 'POST',
    body: JSON.stringify({ provider: event.provider || 'mock', event_id: event.event_id, event_type: event.type, user_id: event.user_id || null, processed: true, payload_sanitized: sanitizeMetadata(event) }),
  })
  if (event.user_id && event.plan_code) {
    const status = event.type === 'subscription_canceled' ? 'canceled' : event.type === 'payment_failed' ? 'past_due' : 'active'
    await serviceRestRequest('billing_subscriptions', {
      method: 'POST',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({ user_id: event.user_id, provider: event.provider || 'mock', provider_subscription_id: event.provider_subscription_id || null, plan_code: event.plan_code, status, current_period_start: new Date().toISOString(), current_period_end: event.current_period_end || null }),
    })
  }
  return jsonResponse({ processed: true })
})
