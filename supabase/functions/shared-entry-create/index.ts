import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { requireAuthenticatedUser } from '../_shared/auth.ts'
import { corsHeaders, jsonResponse } from '../_shared/cors.ts'
import { serviceRestRequest } from '../_shared/release10/rest.ts'
import {
  assertActiveParticipants,
  assertUuid,
  auditFamily,
  calculateParticipants,
  edgeErrorResponse,
  listActiveMemberships,
  normalizeSharedEntryInput,
  notifyFamilyMembersOfSharedEntry,
  rejectControlledIdentity,
  requireSharedEntryWriter,
} from '../_shared/family-sharing.ts'

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  try {
    const { user } = await requireAuthenticatedUser(req)
    const body = await req.json().catch(() => ({}))
    rejectControlledIdentity(body || {}, ['family_id', 'familyId', 'finance_state', 'financeState'])

    const familyGroupId = assertUuid(body.family_group_id || body.familyGroupId, 'Familia')
    await requireSharedEntryWriter(user.id, familyGroupId)
    const activeMemberships = await listActiveMemberships(familyGroupId)
    const input = normalizeSharedEntryInput(body, user.id, activeMemberships)
    const paidByUserId = input.split_method === 'paid_by_me' ? user.id : input.paid_by_user_id
    await assertActiveParticipants(familyGroupId, [...input.participant_user_ids, paidByUserId])

    const entries = await serviceRestRequest('shared_entries?select=id,family_group_id,created_by,paid_by_user_id,type,description,amount,category,entry_date,split_method,notes,source,created_at,updated_at', {
      method: 'POST',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify({
        family_group_id: familyGroupId,
        created_by: user.id,
        paid_by_user_id: paidByUserId,
        type: input.type,
        description: input.description,
        amount: input.amount,
        category: input.category,
        entry_date: input.entry_date,
        split_method: input.split_method,
        notes: input.notes,
        source: 'manual',
      }),
    }) as Array<Record<string, unknown>>
    const entry = entries?.[0]
    const participantRows = calculateParticipants(input.amount, input.participant_user_ids, input.split_method)
      .map((participant) => ({ ...participant, shared_entry_id: entry.id }))
    const participants = await serviceRestRequest('shared_entry_participants?select=id,shared_entry_id,user_id,allocation_type,allocation_value,calculated_amount,created_at', {
      method: 'POST',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify(participantRows),
    }) as Array<Record<string, unknown>>

    await auditFamily(user.id, 'shared_entry_created', 'shared_entry', {
      resource_id: String(entry.id),
      metadata: { family_group_id: familyGroupId, split_method: input.split_method },
    })
    await notifyFamilyMembersOfSharedEntry({
      familyGroupId,
      actorUserId: user.id,
      entry,
      action: 'shared_entry_created',
    })
    return jsonResponse({
      entry: {
        ...entry,
        participants,
        family_total: Number(entry.amount || 0),
        my_amount: Number(participants.find((row) => row.user_id === user.id)?.calculated_amount || 0),
      },
    })
  } catch (error) {
    return edgeErrorResponse(error)
  }
})
