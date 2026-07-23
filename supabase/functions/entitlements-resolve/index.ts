import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { requireAuthenticatedUser } from '../_shared/auth.ts'
import { authErrorResponse, corsHeaders, jsonResponse } from '../_shared/cors.ts'
import { audit, rejectIdentityOverride, serviceRestRequest } from '../_shared/release10/rest.ts'
import { resolveRelease10Entitlements } from '../_shared/release10/entitlements.ts'

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  try {
    const { user } = await requireAuthenticatedUser(req)
    const body = await req.json().catch(() => ({}))
    rejectIdentityOverride(body)
    const subscriptions = await serviceRestRequest(`billing_subscriptions?select=plan_code,status,current_period_end&user_id=eq.${user.id}&order=updated_at.desc&limit=1`) as any[]
    const testers = await serviceRestRequest(`beta_testers?select=status,tester_group,access_expires_at&user_id=eq.${user.id}&limit=1`) as any[]
    const overrides = await serviceRestRequest(`user_feature_overrides?select=feature_key,enabled,expires_at&user_id=eq.${user.id}`) as any[]
    const entitlements = resolveRelease10Entitlements({ subscription: subscriptions?.[0] || { status: 'free', plan_code: 'free' }, tester: testers?.[0], overrides })
    await audit(user.id, 'entitlements_resolved', 'entitlements', { metadata: { plan_code: entitlements.plan_code, is_tester: entitlements.is_tester } })
    return jsonResponse(entitlements)
  } catch (error) {
    return authErrorResponse((error as any)?.code || 'UNAUTHORIZED', error instanceof Error ? error.message : 'Nao autorizado.', (error as any)?.status || 401)
  }
})
