import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { requireAuthenticatedUser } from '../_shared/auth.ts'
import { corsHeaders, jsonResponse } from '../_shared/cors.ts'
import { serviceRestRequest } from '../_shared/release10/rest.ts'
import { assertInviteAvailableForUser, auditFamily, edgeErrorResponse, findInviteByTokenOrId, rejectControlledIdentity } from '../_shared/family-sharing.ts'

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  try {
    const { user } = await requireAuthenticatedUser(req)
    const body = await req.json().catch(() => ({}))
    rejectControlledIdentity(body || {}, ['family_id', 'familyId', 'family_group_id', 'familyGroupId', 'status'])

    const invite = await findInviteByTokenOrId(body)
    const inviteId = body.invite_id || body.inviteId
    assertInviteAvailableForUser(invite, user)

    const now = new Date().toISOString()
    await serviceRestRequest(`family_invites?id=eq.${encodeURIComponent(String(invite?.id))}`, {
      method: 'PATCH',
      body: JSON.stringify({ status: 'declined', declined_at: now }),
    })
    await auditFamily(user.id, 'family_invite_declined', 'family_invite', {
      resource_id: String(invite?.id),
      metadata: { family_group_id: invite?.family_group_id, declined_by_invite_id: Boolean(inviteId) },
    })
    return jsonResponse({ ok: true })
  } catch (error) {
    return edgeErrorResponse(error)
  }
})
