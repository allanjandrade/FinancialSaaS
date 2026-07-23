import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { requireAuthenticatedUser } from '../_shared/auth.ts'
import { authErrorResponse, corsHeaders, jsonResponse } from '../_shared/cors.ts'
import { audit, rejectIdentityOverride, requireAdmin, resolveTargetUserId, serviceRestRequest } from '../_shared/release10/rest.ts'

const allowedPlans = new Set(['free', 'premium_monthly', 'premium_annual'])

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  try {
    const { user } = await requireAuthenticatedUser(req)
    const body = await req.json().catch(() => ({}))
    rejectIdentityOverride(body, ['user_id', 'userId', 'role', 'is_admin', 'permissions', 'subscription_status'])
    await requireAdmin(user.id, ['owner', 'admin'])
    const targetUserId = await resolveTargetUserId(body)
    const planCode = String(body.plan_code || 'free')
    if (!allowedPlans.has(planCode)) throw Object.assign(new Error('Plano invalido.'), { status: 400, code: 'INVALID_PLAN' })

    const now = new Date()
    const end = new Date(now)
    end.setMonth(end.getMonth() + 1)
    const status = planCode === 'free' ? 'free' : 'active'
    const rows = await serviceRestRequest('billing_subscriptions?select=id,user_id,plan_code,status,current_period_end,updated_at', {
      method: 'POST',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify({
        user_id: targetUserId,
        provider: 'admin_manual',
        provider_subscription_id: `manual_${targetUserId}_${Date.now()}`,
        plan_code: planCode,
        status,
        current_period_start: now.toISOString(),
        current_period_end: planCode === 'free' ? null : end.toISOString(),
        cancel_at_period_end: false,
      }),
    })
    await audit(user.id, 'admin_set_user_plan', 'billing_subscription', { target_user_id: targetUserId, metadata: { plan_code: planCode, status } })
    return jsonResponse({ subscription: rows?.[0] || null })
  } catch (error) {
    return authErrorResponse((error as any)?.code || 'FORBIDDEN', error instanceof Error ? error.message : 'Acesso negado.', (error as any)?.status || 403)
  }
})
