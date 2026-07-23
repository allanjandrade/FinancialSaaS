import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { requireAuthenticatedUser } from '../_shared/auth.ts'
import { authErrorResponse, corsHeaders, jsonResponse } from '../_shared/cors.ts'
import { serviceRestRequest } from '../_shared/release10/rest.ts'

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  try {
    const { user } = await requireAuthenticatedUser(req)
    const rows = await serviceRestRequest(`billing_subscriptions?select=id,plan_code,status,cancel_at_period_end&user_id=eq.${user.id}`, {
      method: 'PATCH',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify({ status: 'canceled', cancel_at_period_end: true, updated_at: new Date().toISOString() }),
    })
    return jsonResponse({ subscription: rows?.[0] || { plan_code: 'free', status: 'free' } })
  } catch (error) {
    return authErrorResponse((error as any)?.code || 'UNAUTHORIZED', error instanceof Error ? error.message : 'Nao autorizado.', (error as any)?.status || 401)
  }
})
