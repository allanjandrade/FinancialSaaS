import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { corsHeaders, jsonResponse } from '../_shared/cors.ts'

function serviceConfig() {
  const url = Deno.env.get('SUPABASE_URL')
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!url || !key) throw new Error('Supabase service configuration missing')
  return { url, key }
}

async function checkTable(path: string) {
  const { url, key } = serviceConfig()
  const response = await fetch(`${url}/rest/v1/${path}`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
  })
  return response.ok ? 'ok' : 'degraded'
}

async function checkAuth() {
  const { url, key } = serviceConfig()
  const response = await fetch(`${url}/auth/v1/settings`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
  })
  return response.ok ? 'ok' : 'degraded'
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'GET' && req.method !== 'POST') {
    return jsonResponse({ error: { code: 'METHOD_NOT_ALLOWED', message: 'Metodo nao permitido.' } }, 405)
  }
  try {
    const [auth, database, featureFlags, automations, aiActions, observability, billing, entitlements] = await Promise.all([
      checkAuth(),
      checkTable('finance_states?select=family_id&limit=1'),
      checkTable('feature_flags?select=key&limit=1'),
      checkTable('user_automations?select=id&limit=1'),
      checkTable('ai_action_logs?select=id&limit=1'),
      checkTable('system_events?select=id&limit=1'),
      checkTable('billing_subscriptions?select=id&limit=1'),
      checkTable('feature_entitlements?select=id&limit=1'),
    ])
    return jsonResponse({
      status: [auth, database, featureFlags, automations, aiActions, observability, billing, entitlements].every((item) => item === 'ok') ? 'ok' : 'degraded',
      version: 'release-11',
      checks: {
        auth,
        db: database,
        functions: 'ok',
        feature_flags: featureFlags,
        automations,
        ai_actions: aiActions,
        observability,
        entitlements,
        billing,
      },
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    return jsonResponse({
      status: 'degraded',
      version: 'release-11',
      checks: {
        auth: 'degraded',
        db: 'degraded',
        functions: 'degraded',
        feature_flags: 'degraded',
        automations: 'degraded',
        ai_actions: 'degraded',
        observability: 'degraded',
        entitlements: 'degraded',
        billing: 'degraded',
      },
      timestamp: new Date().toISOString(),
    }, 503)
  }
})
