import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { requireAuthenticatedUser } from '../_shared/auth.ts'
import { authErrorResponse, corsHeaders, jsonResponse } from '../_shared/cors.ts'

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  try {
    await requireAuthenticatedUser(req)
    return jsonResponse({ provider: 'mock_gateway', portal_url: 'https://checkout.example.invalid/portal' })
  } catch (error) {
    return authErrorResponse((error as any)?.code || 'UNAUTHORIZED', error instanceof Error ? error.message : 'Nao autorizado.', (error as any)?.status || 401)
  }
})
