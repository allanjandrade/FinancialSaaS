import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { requireAuthenticatedUser } from '../_shared/auth.ts'
import { corsHeaders, jsonResponse } from '../_shared/cors.ts'
import { serviceRestRequest } from '../_shared/release10/rest.ts'
import { assertUuid, auditFamily, edgeErrorResponse, fail, rejectControlledIdentity, requireManager } from '../_shared/family-sharing.ts'

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  try {
    const { user } = await requireAuthenticatedUser(req)
    const body = await req.json().catch(() => ({}))
    rejectControlledIdentity(body || {}, ['family_id', 'familyId', 'user_id', 'userId', 'role', 'status'])

    const familyGroupId = assertUuid(body.family_group_id || body.familyGroupId, 'Familia')
    await requireManager(user.id, familyGroupId)

    const membershipId = body.membership_id || body.membershipId
    const memberUserId = body.member_user_id || body.memberUserId
    const filter = membershipId
      ? `id=eq.${encodeURIComponent(assertUuid(membershipId, 'Membro'))}`
      : `user_id=eq.${encodeURIComponent(assertUuid(memberUserId, 'Usuario do membro'))}`
    const rows = await serviceRestRequest(
      `family_memberships?select=id,family_group_id,user_id,role,status&family_group_id=eq.${encodeURIComponent(familyGroupId)}&${filter}&limit=1`,
    ) as Array<Record<string, unknown>>
    const membership = rows?.[0]
    if (!membership) fail('Membro nao encontrado.', 404, 'MEMBER_NOT_FOUND')
    if (membership.role === 'owner') fail('O owner da familia nao pode ser removido por este fluxo.', 403, 'OWNER_IMMUTABLE')

    const updated = await serviceRestRequest(`family_memberships?id=eq.${encodeURIComponent(String(membership.id))}&select=id,family_group_id,user_id,role,status`, {
      method: 'PATCH',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify({ status: 'removed' }),
    }) as Array<Record<string, unknown>>

    await auditFamily(user.id, 'family_member_removed', 'family_membership', {
      resource_id: String(membership.id),
      target_user_id: String(membership.user_id),
      metadata: { family_group_id: familyGroupId },
    })
    return jsonResponse({ membership: updated?.[0] || null })
  } catch (error) {
    return edgeErrorResponse(error)
  }
})
