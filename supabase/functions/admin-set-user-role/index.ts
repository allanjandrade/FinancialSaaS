import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { requireAuthenticatedUser } from '../_shared/auth.ts'
import { authErrorResponse, corsHeaders, jsonResponse } from '../_shared/cors.ts'
import { audit, rejectIdentityOverride, requireAdmin, resolveTargetUserId, serviceRestRequest } from '../_shared/release10/rest.ts'

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  try {
    const { user } = await requireAuthenticatedUser(req)
    const body = await req.json().catch(() => ({}))
    rejectIdentityOverride(body, ['is_admin', 'permissions', 'subscription_status'])
    const access = await requireAdmin(user.id, ['owner'])
    const targetUserId = await resolveTargetUserId(body)
    if (targetUserId === user.id && body.role === 'owner') throw Object.assign(new Error('Admin nao pode promover a si mesmo.'), { status: 403, code: 'FORBIDDEN' })
    if (!['owner', 'admin', 'support'].includes(body.role)) throw Object.assign(new Error('Role invalida.'), { status: 400, code: 'INVALID_ROLE' })
    const rows = await serviceRestRequest('admin_users?select=id,user_id,role,active,updated_at', {
      method: 'POST',
      headers: { Prefer: 'resolution=merge-duplicates,return=representation' },
      body: JSON.stringify({ user_id: targetUserId, role: body.role, active: body.active !== false, created_by: user.id }),
    })
    await audit(user.id, 'admin_set_user_role', 'admin_user', { target_user_id: targetUserId, metadata: { role: body.role, actor_role: access.role } })
    return jsonResponse({ admin_user: rows?.[0] || null })
  } catch (error) {
    return authErrorResponse((error as any)?.code || 'FORBIDDEN', error instanceof Error ? error.message : 'Acesso negado.', (error as any)?.status || 403)
  }
})
