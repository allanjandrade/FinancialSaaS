import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { requireAuthenticatedUser } from '../_shared/auth.ts'
import { corsHeaders, jsonResponse } from '../_shared/cors.ts'
import { serviceRestRequest } from '../_shared/release10/rest.ts'
import { edgeErrorResponse, getFamilyGroup, normalizeText, rejectControlledIdentity } from '../_shared/family-sharing.ts'

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  try {
    const { user } = await requireAuthenticatedUser(req)
    const body = await req.json().catch(() => ({}))
    rejectControlledIdentity(body || {}, ['family_id', 'familyId', 'family_group_id', 'familyGroupId', 'email', 'user_email', 'userEmail'])

    const email = normalizeText(user.email).toLowerCase()
    if (!email) return jsonResponse({ invites: [] })

    const rows = await serviceRestRequest(
      `family_invites?select=id,family_group_id,invited_email,email,role,status,expires_at,created_at&status=eq.pending&or=(invited_email.eq.${encodeURIComponent(email)},email.eq.${encodeURIComponent(email)})&order=created_at.desc`,
    ) as Array<Record<string, unknown>>

    const activeRows = rows.filter((invite) => new Date(String(invite.expires_at)).getTime() > Date.now())
    const invites = await Promise.all(activeRows.map(async (invite) => ({
      ...invite,
      family: await getFamilyGroup(String(invite.family_group_id || '')).catch(() => null),
    })))

    return jsonResponse({ invites })
  } catch (error) {
    return edgeErrorResponse(error)
  }
})
