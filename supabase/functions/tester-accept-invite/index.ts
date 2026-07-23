import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { requireAuthenticatedUser } from '../_shared/auth.ts'
import { authErrorResponse, corsHeaders, jsonResponse } from '../_shared/cors.ts'
import { audit, serviceRestRequest, sha256Hex } from '../_shared/release10/rest.ts'

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  try {
    const { user } = await requireAuthenticatedUser(req)
    const body = await req.json().catch(() => ({}))
    const token = String(body.token || '')
    const hash = await sha256Hex(token)
    const rows = await serviceRestRequest(`tester_invites?select=id,email,status,tester_group,access_expires_at,expires_at&invite_token_hash=eq.${hash}&limit=1`) as any[]
    const invite = rows?.[0]
    if (!invite || invite.status !== 'pending') throw Object.assign(new Error('Convite indisponivel.'), { status: 403, code: 'FORBIDDEN' })
    if (new Date(invite.expires_at).getTime() <= Date.now()) throw Object.assign(new Error('Convite expirado.'), { status: 403, code: 'FORBIDDEN' })
    await serviceRestRequest(`tester_invites?id=eq.${invite.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ status: 'accepted', accepted_by: user.id, accepted_at: new Date().toISOString() }),
    })
    const testers = await serviceRestRequest('beta_testers?select=id,user_id,status,tester_group,access_expires_at', {
      method: 'POST',
      headers: { Prefer: 'resolution=merge-duplicates,return=representation' },
      body: JSON.stringify({ user_id: user.id, status: 'active', tester_group: invite.tester_group, access_expires_at: invite.access_expires_at || invite.expires_at }),
    })
    await audit(user.id, 'tester_accepted_invite', 'tester_invite', { resource_id: invite.id })
    return jsonResponse({ tester: testers?.[0] || null })
  } catch (error) {
    return authErrorResponse((error as any)?.code || 'FORBIDDEN', error instanceof Error ? error.message : 'Acesso negado.', (error as any)?.status || 403)
  }
})
