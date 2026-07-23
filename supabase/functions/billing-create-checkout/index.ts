import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { requireAuthenticatedUser } from '../_shared/auth.ts'
import { authErrorResponse, corsHeaders, jsonResponse } from '../_shared/cors.ts'
import { rejectIdentityOverride } from '../_shared/release10/rest.ts'

const allowedPlans = new Set(['premium_monthly', 'premium_annual'])

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  try {
    const { user } = await requireAuthenticatedUser(req)
    const body = await req.json().catch(() => ({}))
    rejectIdentityOverride(body)
    const planCode = String(body.plan_code || 'premium_monthly')
    if (!allowedPlans.has(planCode)) throw Object.assign(new Error('Plano indisponivel.'), { status: 400, code: 'INVALID_PLAN' })
    return jsonResponse({
      provider: 'mock_gateway',
      plan_code: planCode,
      checkout_url: `https://checkout.example.invalid/${planCode}?ref=${user.id}`,
      financial_payload_sent: false,
    })
  } catch (error) {
    return authErrorResponse((error as any)?.code || 'UNAUTHORIZED', error instanceof Error ? error.message : 'Nao autorizado.', (error as any)?.status || 401)
  }
})
