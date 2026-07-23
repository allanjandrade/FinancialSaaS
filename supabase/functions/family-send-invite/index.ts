import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { requireAuthenticatedUser } from '../_shared/auth.ts'
import { corsHeaders, jsonResponse } from '../_shared/cors.ts'
import {
  assertUuid,
  auditFamily,
  buildInviteUrl,
  createInviteRecord,
  edgeErrorResponse,
  getFamilyGroup,
  normalizeEmail,
  normalizeInviteRole,
  normalizeText,
  notifyExistingInvitedUser,
  rejectControlledIdentity,
  requireManager,
} from '../_shared/family-sharing.ts'

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  try {
    const { user } = await requireAuthenticatedUser(req)
    const body = await req.json().catch(() => ({}))
    rejectControlledIdentity(body || {}, ['family_id', 'familyId', 'token', 'token_hash', 'tokenHash', 'status'])

    const familyGroupId = assertUuid(body.family_group_id || body.familyGroupId, 'Familia')
    await requireManager(user.id, familyGroupId)
    const family = await getFamilyGroup(familyGroupId)
    if (!family) throw Object.assign(new Error('Familia nao encontrada.'), { status: 404, code: 'FAMILY_NOT_FOUND' })

    const invitedEmail = normalizeEmail(body.email || body.invited_email || body.invitedEmail)
    const role = normalizeInviteRole(body.role)
    const message = normalizeText(body.message).slice(0, 400) || null
    const { invite, token } = await createInviteRecord({ familyGroupId, invitedBy: user.id, invitedEmail, role, message })
    const inviteUrl = buildInviteUrl(req, token)
    const notification = await notifyExistingInvitedUser({ invitedEmail, invitedBy: user.id, family, invite })

    await auditFamily(user.id, 'family_invite_sent', 'family_invite', {
      resource_id: String(invite?.id || ''),
      metadata: { family_group_id: familyGroupId, invited_email: invitedEmail, role, notified_existing_user: Boolean(notification) },
    })

    return jsonResponse({
      invite,
      token,
      invite_url: inviteUrl,
      notified_existing_user: Boolean(notification),
      message: 'Se este e-mail puder receber convite, o acesso ficara disponivel pelo link gerado.',
    })
  } catch (error) {
    return edgeErrorResponse(error)
  }
})
