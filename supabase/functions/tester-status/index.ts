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
    const email = String(body.email || user.email || '').trim().toLowerCase()
    if (body.email && email !== String(user.email || '').trim().toLowerCase()) {
      return authErrorResponse('FORBIDDEN', 'Acesso negado.', 403)
    }
    const rows = await serviceRestRequest(`beta_testers?select=status,tester_group,access_starts_at,access_expires_at&user_id=eq.${user.id}&limit=1`) as any[]
    const tester = rows?.[0] || null
    const inviteRows = email
      ? await serviceRestRequest(`tester_invites?select=status,expires_at,email&email=eq.${encodeURIComponent(email)}&status=eq.pending&limit=1`) as any[]
      : []
    const invite = inviteRows?.[0] || null
    const inviteAllowed = Boolean(invite?.status === 'pending' && new Date(invite.expires_at).getTime() > Date.now())
    return jsonResponse({
      tester,
      active: tester?.status === 'active' && tester.access_expires_at && new Date(tester.access_expires_at).getTime() > Date.now(),
      invite_allowed: inviteAllowed,
    })
  } catch (error) {
    return authErrorResponse((error as any)?.code || 'UNAUTHORIZED', error instanceof Error ? error.message : 'Nao autorizado.', (error as any)?.status || 401)
  }
})
