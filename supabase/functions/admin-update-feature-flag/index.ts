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
    const rows = await serviceRestRequest(`feature_flags?select=feature_key:key,enabled_default:enabled,rollout_percentage,updated_at&key=eq.${encodeURIComponent(body.feature_key)}`, {
      method: 'PATCH',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify({ enabled: Boolean(body.enabled_default), rollout_percentage: Math.max(0, Math.min(100, Number(body.rollout_percentage || 0))), updated_at: new Date().toISOString() }),
    })
    await audit(user.id, 'admin_changed_feature_flag', 'feature_flag', { resource_id: body.feature_key, metadata: { enabled_default: Boolean(body.enabled_default), rollout_percentage: body.rollout_percentage } })
    return jsonResponse({ flag: rows?.[0] || null })
  } catch (error) {
    return authErrorResponse((error as any)?.code || 'FORBIDDEN', error instanceof Error ? error.message : 'Acesso negado.', (error as any)?.status || 403)
  }
})
