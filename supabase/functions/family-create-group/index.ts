import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { requireAuthenticatedUser } from '../_shared/auth.ts'
import { corsHeaders, jsonResponse } from '../_shared/cors.ts'
import { serviceRestRequest } from '../_shared/release10/rest.ts'
import { auditFamily, edgeErrorResponse, fail, normalizeText, rejectControlledIdentity } from '../_shared/family-sharing.ts'

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  try {
    const { user } = await requireAuthenticatedUser(req)
    const body = await req.json().catch(() => ({}))
    rejectControlledIdentity(body || {}, ['family_id', 'familyId', 'role', 'status'])

    const name = normalizeText(body.name)
    if (name.length < 2) fail('Informe o nome da familia.', 400, 'INVALID_FAMILY_NAME')

    const families = await serviceRestRequest('family_groups?select=id,name,owner_user_id,created_at,updated_at', {
      method: 'POST',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify({ name, owner_user_id: user.id }),
    }) as Array<Record<string, unknown>>
    const family = families?.[0]
    if (!family?.id) fail('Nao foi possivel criar a familia.', 500, 'FAMILY_CREATE_FAILED')

    try {
      const memberships = await serviceRestRequest('family_memberships?select=id,family_group_id,user_id,role,status,joined_at', {
        method: 'POST',
        headers: { Prefer: 'return=representation' },
        body: JSON.stringify({
          family_group_id: family.id,
          user_id: user.id,
          role: 'owner',
          status: 'active',
          joined_at: new Date().toISOString(),
        }),
      }) as Array<Record<string, unknown>>
      await auditFamily(user.id, 'family_group_created', 'family_group', { resource_id: String(family.id), metadata: { name } })
      return jsonResponse({ family, membership: memberships?.[0] || null })
    } catch (error) {
      await serviceRestRequest(`family_groups?id=eq.${encodeURIComponent(String(family.id))}`, { method: 'DELETE' }).catch(() => undefined)
      throw error
    }
  } catch (error) {
    return edgeErrorResponse(error)
  }
})
