import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { requireAuthenticatedUser } from '../_shared/auth.ts'
import { authErrorResponse, corsHeaders, jsonResponse } from '../_shared/cors.ts'
import { rejectIdentityOverride, serviceRestRequest } from '../_shared/release10/rest.ts'

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  try {
    const { user } = await requireAuthenticatedUser(req)
    const body = await req.json().catch(() => ({}))
    rejectIdentityOverride(body)
    const rows = await serviceRestRequest(`billing_subscriptions?select=plan_code,status,current_period_start,current_period_end,cancel_at_period_end&user_id=eq.${user.id}&order=updated_at.desc&limit=1`) as any[]
    return jsonResponse({ subscription: rows?.[0] || { plan_code: 'free', status: 'free' } })
  } catch (error) {
    return authErrorResponse((error as any)?.code || 'UNAUTHORIZED', error instanceof Error ? error.message : 'Nao autorizado.', (error as any)?.status || 401)
  }
})
