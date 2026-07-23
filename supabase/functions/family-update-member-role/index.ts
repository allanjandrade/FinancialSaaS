import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { requireAuthenticatedUser } from '../_shared/auth.ts'
import { corsHeaders, jsonResponse } from '../_shared/cors.ts'
import { serviceRestRequest } from '../_shared/release10/rest.ts'
import { assertUuid, auditFamily, edgeErrorResponse, fail, normalizeInviteRole, rejectControlledIdentity, requireManager } from '../_shared/family-sharing.ts'

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  try {
    const { user } = await requireAuthenticatedUser(req)
    const body = await req.json().catch(() => ({}))
    rejectControlledIdentity(body || {}, ['family_id', 'familyId', 'user_id', 'userId', 'status'])

    const familyGroupId = assertUuid(body.family_group_id || body.familyGroupId, 'Familia')
    await requireManager(user.id, familyGroupId)
    const membershipId = assertUuid(body.membership_id || body.membershipId, 'Membro')
    const role = normalizeInviteRole(body.role)

    const rows = await serviceRestRequest(
      `family_memberships?select=id,family_group_id,user_id,role,status&family_group_id=eq.${encodeURIComponent(familyGroupId)}&id=eq.${encodeURIComponent(membershipId)}&limit=1`,
    ) as Array<Record<string, unknown>>
    const membership = rows?.[0]
    if (!membership) fail('Membro nao encontrado.', 404, 'MEMBER_NOT_FOUND')
    if (membership.role === 'owner') fail('O papel owner nao pode ser alterado por este fluxo.', 403, 'OWNER_IMMUTABLE')

    const updated = await serviceRestRequest(`family_memberships?id=eq.${encodeURIComponent(membershipId)}&select=id,family_group_id,user_id,role,status,updated_at`, {
      method: 'PATCH',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify({ role }),
    }) as Array<Record<string, unknown>>
    await auditFamily(user.id, 'family_member_role_updated', 'family_membership', {
      resource_id: membershipId,
      target_user_id: String(membership.user_id),
      metadata: { family_group_id: familyGroupId, role },
    })
    return jsonResponse({ membership: updated?.[0] || null })
  } catch (error) {
    return edgeErrorResponse(error)
  }
})
