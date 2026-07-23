import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { authErrorDetails, rejectIdentityOverride, requireAuthenticatedUser } from '../_shared/auth.ts'
import { authErrorResponse, corsHeaders, errorResponse, jsonResponse } from '../_shared/cors.ts'
import { userRestRequest } from '../_shared/finance-state.ts'

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return errorResponse('Metodo nao permitido', 405)
  try {
    const { token } = await requireAuthenticatedUser(req)
    const body = await req.json().catch(() => ({}))
    rejectIdentityOverride(body)
    const flags = await userRestRequest('rpc/get_my_feature_flags', token, {
      method: 'POST', body: '{}',
    })
    return jsonResponse({ flags: flags || [] })
  } catch (error) {
    const auth = authErrorDetails(error)
    if (auth) return authErrorResponse(auth.code, auth.message, auth.status)
    return errorResponse('Erro ao carregar feature flags', 500)
  }
})
