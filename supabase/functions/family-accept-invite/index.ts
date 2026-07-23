import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { requireAuthenticatedUser } from '../_shared/auth.ts'
import { corsHeaders, jsonResponse } from '../_shared/cors.ts'
import { serviceRestRequest } from '../_shared/release10/rest.ts'
import { assertInviteAvailableForUser, auditFamily, edgeErrorResponse, fail, findInviteByTokenOrId, getFamilyGroup, rejectControlledIdentity } from '../_shared/family-sharing.ts'

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  try {
    const { user } = await requireAuthenticatedUser(req)
    const body = await req.json().catch(() => ({}))
    rejectControlledIdentity(body || {}, ['family_id', 'familyId', 'family_group_id', 'familyGroupId', 'status'])

    const invite = await findInviteByTokenOrId(body)
    const inviteId = body.invite_id || body.inviteId
    assertInviteAvailableForUser(invite, user)

    const familyGroupId = String(invite?.family_group_id || '')
    const family = await getFamilyGroup(familyGroupId)
    if (!family) fail('Familia nao encontrada.', 404, 'FAMILY_NOT_FOUND')

    const now = new Date().toISOString()
    const memberships = await serviceRestRequest('family_memberships?on_conflict=family_group_id,user_id&select=id,family_group_id,user_id,role,status,joined_at', {
      method: 'POST',
      headers: { Prefer: 'resolution=merge-duplicates,return=representation' },
      body: JSON.stringify({
        family_group_id: familyGroupId,
        user_id: user.id,
        role: invite?.role || 'member',
        status: 'active',
        joined_at: now,
      }),
    }) as Array<Record<string, unknown>>

    await serviceRestRequest(`family_invites?id=eq.${encodeURIComponent(String(invite?.id))}`, {
      method: 'PATCH',
      body: JSON.stringify({ status: 'accepted', accepted_by: user.id, accepted_at: now }),
    })
    await auditFamily(user.id, 'family_invite_accepted', 'family_invite', {
      resource_id: String(invite?.id),
      metadata: { family_group_id: familyGroupId, accepted_by_invite_id: Boolean(inviteId) },
    })
    return jsonResponse({ family, membership: memberships?.[0] || null })
  } catch (error) {
    return edgeErrorResponse(error)
  }
})
