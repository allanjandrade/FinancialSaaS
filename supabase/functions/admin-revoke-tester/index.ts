import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { requireAuthenticatedUser } from '../_shared/auth.ts'
import { authErrorResponse, corsHeaders, jsonResponse } from '../_shared/cors.ts'
import { audit, requireAdmin, serviceRestRequest } from '../_shared/release10/rest.ts'

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  try {
    const { user } = await requireAuthenticatedUser(req)
    const body = await req.json().catch(() => ({}))
    await requireAdmin(user.id, ['owner', 'admin'])
    const target = String(body.target_user_id || '')
    const rows = await serviceRestRequest(`beta_testers?select=id,user_id,status,tester_group,access_expires_at&user_id=eq.${encodeURIComponent(target)}`, {
      method: 'PATCH',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify({ status: 'revoked', updated_at: new Date().toISOString() }),
    })
    await audit(user.id, 'admin_revoked_tester', 'beta_tester', { target_user_id: target, resource_id: rows?.[0]?.id })
    return jsonResponse({ tester: rows?.[0] || null })
  } catch (error) {
    return authErrorResponse((error as any)?.code || 'FORBIDDEN', error instanceof Error ? error.message : 'Acesso negado.', (error as any)?.status || 403)
  }
})
