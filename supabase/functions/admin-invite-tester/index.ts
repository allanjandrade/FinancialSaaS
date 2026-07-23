import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { requireAuthenticatedUser } from '../_shared/auth.ts'
import { authErrorResponse, corsHeaders, jsonResponse } from '../_shared/cors.ts'
import { audit, randomToken, rejectIdentityOverride, requireAdmin, serviceRestRequest, sha256Hex } from '../_shared/release10/rest.ts'

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  try {
    const { user } = await requireAuthenticatedUser(req)
    const body = await req.json().catch(() => ({}))
    rejectIdentityOverride(body)
    await requireAdmin(user.id, ['owner', 'admin'])
    const email = String(body.email || '').toLowerCase()
    if (!email.includes('@')) throw Object.assign(new Error('Email invalido.'), { status: 400 })
    const token = randomToken()
    const expires = body.access_expires_at || new Date(Date.now() + 14 * 86400000).toISOString()
    const rows = await serviceRestRequest('tester_invites?select=id,email,status,tester_group,access_expires_at,expires_at,created_at', {
      method: 'POST',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify({ email, invite_token_hash: await sha256Hex(token), status: 'pending', tester_group: body.tester_group || 'default', access_expires_at: expires, expires_at: expires, created_by: user.id }),
    })
    await audit(user.id, 'admin_invited_tester', 'tester_invite', { resource_id: rows?.[0]?.id, metadata: { email, tester_group: body.tester_group || 'default' } })
    return jsonResponse({ invite: rows?.[0] || null, token }, 201)
  } catch (error) {
    return authErrorResponse((error as any)?.code || 'FORBIDDEN', error instanceof Error ? error.message : 'Acesso negado.', (error as any)?.status || 403)
  }
})
