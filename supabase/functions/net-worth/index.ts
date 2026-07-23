import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { authErrorDetails, rejectIdentityOverride, requireAuthenticatedUser } from '../_shared/auth.ts'
import { authErrorResponse, corsHeaders, errorResponse, jsonResponse } from '../_shared/cors.ts'
import { loadAuthorizedFinanceState } from '../_shared/finance-state.ts'
import { calculateNetWorth } from '../_shared/financial-calculations.ts'

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return errorResponse('Metodo nao permitido', 405)
  try {
    const { token, user } = await requireAuthenticatedUser(req)
    const body = await req.json().catch(() => ({}))
    rejectIdentityOverride(body)
    const row = await loadAuthorizedFinanceState(token, user.id, body.familyId ? String(body.familyId) : undefined)
    return jsonResponse({ familyId: row.family_id, updatedAt: row.updated_at, netWorth: calculateNetWorth(row.data) })
  } catch (error) {
    const auth = authErrorDetails(error)
    if (auth) return authErrorResponse(auth.code, auth.message, auth.status)
    return errorResponse('Erro ao calcular patrimonio liquido', 500)
  }
})
