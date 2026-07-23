import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { requireAuthenticatedUser } from '../_shared/auth.ts'
import { authErrorResponse, corsHeaders, jsonResponse } from '../_shared/cors.ts'
import { audit, rejectIdentityOverride, requireAdmin, serviceRestRequest } from '../_shared/release10/rest.ts'

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  try {
    const { user } = await requireAuthenticatedUser(req)
    const body = await req.json().catch(() => ({}))
    rejectIdentityOverride(body)
    await requireAdmin(user.id, ['owner', 'admin'])
    if (!body.reason) throw Object.assign(new Error('Reason obrigatorio.'), { status: 400 })
    const flags = await serviceRestRequest(`feature_flags?select=key&key=eq.${encodeURIComponent(body.feature_key)}&limit=1`)
    if (!flags?.[0]) throw Object.assign(new Error('Feature inexistente.'), { status: 400 })
    const rows = await serviceRestRequest('user_feature_overrides?select=id,user_id,feature_key,enabled,reason,expires_at,updated_at', {
      method: 'POST',
      headers: { Prefer: 'resolution=merge-duplicates,return=representation' },
      body: JSON.stringify({ user_id: body.target_user_id, feature_key: body.feature_key, enabled: Boolean(body.enabled), reason: body.reason, expires_at: body.expires_at || null, created_by: user.id }),
    })
    await audit(user.id, 'admin_set_feature_override', 'user_feature_override', { target_user_id: body.target_user_id, metadata: { feature_key: body.feature_key, enabled: Boolean(body.enabled), reason: body.reason } })
    return jsonResponse({ override: rows?.[0] || null })
  } catch (error) {
    return authErrorResponse((error as any)?.code || 'FORBIDDEN', error instanceof Error ? error.message : 'Acesso negado.', (error as any)?.status || 403)
  }
})
