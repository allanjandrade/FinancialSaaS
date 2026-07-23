import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { requireAuthenticatedUser } from '../_shared/auth.ts'
import { corsHeaders, jsonResponse } from '../_shared/cors.ts'
import { serviceRestRequest } from '../_shared/release10/rest.ts'
import { assertUuid, auditFamily, edgeErrorResponse, fail, rejectControlledIdentity, requireSharedEntryWriter } from '../_shared/family-sharing.ts'

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  try {
    const { user } = await requireAuthenticatedUser(req)
    const body = await req.json().catch(() => ({}))
    rejectControlledIdentity(body || {}, ['family_id', 'familyId', 'finance_state', 'financeState'])

    const sharedEntryId = assertUuid(body.shared_entry_id || body.sharedEntryId, 'Lancamento compartilhado')
    const rows = await serviceRestRequest(
      `shared_entries?select=id,family_group_id,created_by,deleted_at&deleted_at=is.null&id=eq.${encodeURIComponent(sharedEntryId)}&limit=1`,
    ) as Array<Record<string, unknown>>
    const entry = rows?.[0]
    if (!entry) fail('Lancamento compartilhado nao encontrado.', 404, 'SHARED_ENTRY_NOT_FOUND')

    const membership = await requireSharedEntryWriter(user.id, String(entry.family_group_id))
    const canManage = ['owner', 'admin'].includes(String(membership.role))
    if (!canManage && entry.created_by !== user.id) {
      fail('Somente o criador, owner ou admin podem remover este lancamento.', 403, 'FORBIDDEN')
    }

    await serviceRestRequest(`shared_entries?id=eq.${encodeURIComponent(sharedEntryId)}`, {
      method: 'PATCH',
      body: JSON.stringify({ deleted_at: new Date().toISOString() }),
    })
    await auditFamily(user.id, 'shared_entry_deleted', 'shared_entry', {
      resource_id: sharedEntryId,
      metadata: { family_group_id: entry.family_group_id },
    })
    return jsonResponse({ ok: true })
  } catch (error) {
    return edgeErrorResponse(error)
  }
})
