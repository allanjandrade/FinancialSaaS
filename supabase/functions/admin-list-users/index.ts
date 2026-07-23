import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { requireAuthenticatedUser } from '../_shared/auth.ts'
import { authErrorResponse, corsHeaders, jsonResponse } from '../_shared/cors.ts'
import { authAdminRequest, requireAdmin, serviceRestRequest } from '../_shared/release10/rest.ts'

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  try {
    const { user } = await requireAuthenticatedUser(req)
    await requireAdmin(user.id)
    const authUsers = await authAdminRequest('users?per_page=1000') as { users?: Array<{ id: string; email?: string; created_at?: string; last_sign_in_at?: string }> }
    const admins = await serviceRestRequest('admin_users?select=user_id,role,active,created_at,updated_at&order=created_at.desc&limit=100')
    const testers = await serviceRestRequest('beta_testers?select=user_id,status,tester_group,access_expires_at,created_at,updated_at&order=created_at.desc&limit=100')
    const billing = await serviceRestRequest('billing_subscriptions?select=user_id,plan_code,status,current_period_end,updated_at&order=updated_at.desc&limit=100')
    const users = (authUsers.users || []).map((item) => ({ id: item.id, email: item.email, created_at: item.created_at, last_sign_in_at: item.last_sign_in_at }))
    return jsonResponse({ users, admins, testers, billing })
  } catch (error) {
    return authErrorResponse((error as any)?.code || 'FORBIDDEN', error instanceof Error ? error.message : 'Acesso negado.', (error as any)?.status || 403)
  }
})
