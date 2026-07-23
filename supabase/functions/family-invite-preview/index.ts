import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { requireAuthenticatedUser } from '../_shared/auth.ts'
import { corsHeaders, jsonResponse } from '../_shared/cors.ts'
import { serviceRestRequest, sha256Hex } from '../_shared/release10/rest.ts'
import { edgeErrorResponse, fail, getFamilyGroup, normalizeText, rejectControlledIdentity } from '../_shared/family-sharing.ts'

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  try {
    const { user } = await requireAuthenticatedUser(req)
    const body = await req.json().catch(() => ({}))
    rejectControlledIdentity(body || {}, ['family_id', 'familyId', 'family_group_id', 'familyGroupId', 'status'])

    const token = normalizeText(body.token)
    if (token.length < 20) fail('Convite indisponivel.', 403, 'FORBIDDEN')
    const hash = await sha256Hex(token)
    const invites = await serviceRestRequest(
      `family_invites?select=id,family_group_id,invited_email,email,role,status,expires_at,created_at&token_hash=eq.${hash}&limit=1`,
    ) as Array<Record<string, unknown>>
    const invite = invites?.[0]
    if (!invite || invite.status !== 'pending') fail('Convite indisponivel.', 403, 'FORBIDDEN')
    if (new Date(String(invite.expires_at)).getTime() <= Date.now()) fail('Convite expirado.', 403, 'FORBIDDEN')

    const invitedEmail = normalizeText(invite.invited_email || invite.email).toLowerCase()
    const sessionEmail = normalizeText(user.email).toLowerCase()
    if (invitedEmail && sessionEmail && invitedEmail !== sessionEmail) {
      fail('Este convite foi enviado para outro e-mail.', 403, 'FORBIDDEN')
    }

    const family = await getFamilyGroup(String(invite.family_group_id || ''))
    if (!family) fail('Familia nao encontrada.', 404, 'FAMILY_NOT_FOUND')
    return jsonResponse({ family, invite })
  } catch (error) {
    return edgeErrorResponse(error)
  }
})
