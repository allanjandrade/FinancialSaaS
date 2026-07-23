import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { requireAuthenticatedUser } from '../_shared/auth.ts'
import { corsHeaders, jsonResponse } from '../_shared/cors.ts'
import { serviceRestRequest } from '../_shared/release10/rest.ts'
import { assertUuid, edgeErrorResponse, rejectControlledIdentity, requireMembership } from '../_shared/family-sharing.ts'

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  try {
    const { user } = await requireAuthenticatedUser(req)
    const body = await req.json().catch(() => ({}))
    rejectControlledIdentity(body || {}, ['family_id', 'familyId', 'finance_state', 'financeState'])

    const familyGroupId = assertUuid(body.family_group_id || body.familyGroupId, 'Familia')
    await requireMembership(user.id, familyGroupId)

    const entries = await serviceRestRequest(
      `shared_entries?select=id,family_group_id,created_by,paid_by_user_id,type,description,amount,category,entry_date,split_method,notes,source,created_at,updated_at&family_group_id=eq.${encodeURIComponent(familyGroupId)}&deleted_at=is.null&order=entry_date.desc,created_at.desc`,
    ) as Array<Record<string, unknown>>
    const ids = entries.map((entry) => String(entry.id))
    const participants = ids.length
      ? await serviceRestRequest(
        `shared_entry_participants?select=id,shared_entry_id,user_id,allocation_type,allocation_value,calculated_amount,created_at&shared_entry_id=in.(${ids.join(',')})`,
      ) as Array<Record<string, unknown>>
      : []
    const byEntry = new Map<string, Array<Record<string, unknown>>>()
    for (const participant of participants) {
      const key = String(participant.shared_entry_id)
      byEntry.set(key, [...(byEntry.get(key) || []), participant])
    }
    const enriched = entries.map((entry) => {
      const entryParticipants = byEntry.get(String(entry.id)) || []
      return {
        ...entry,
        participants: entryParticipants,
        family_total: Number(entry.amount || 0),
        my_amount: Number(entryParticipants.find((row) => row.user_id === user.id)?.calculated_amount || 0),
      }
    })
    return jsonResponse({ entries: enriched })
  } catch (error) {
    return edgeErrorResponse(error)
  }
})
