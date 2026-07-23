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
  fail,
  listActiveMemberships,
  normalizeSharedEntryInput,
  notifyFamilyMembersOfSharedEntry,
  rejectControlledIdentity,
  requireSharedEntryWriter,
  userIdsFromBody,
} from '../_shared/family-sharing.ts'

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  try {
    const { user } = await requireAuthenticatedUser(req)
    const body = await req.json().catch(() => ({}))
    rejectControlledIdentity(body || {}, ['family_id', 'familyId', 'finance_state', 'financeState'])

    const sharedEntryId = assertUuid(body.shared_entry_id || body.sharedEntryId, 'Lancamento compartilhado')
    const currentRows = await serviceRestRequest(
      `shared_entries?select=id,family_group_id,created_by,paid_by_user_id,type,description,amount,category,entry_date,split_method,notes&deleted_at=is.null&id=eq.${encodeURIComponent(sharedEntryId)}&limit=1`,
    ) as Array<Record<string, unknown>>
    const current = currentRows?.[0]
    if (!current) fail('Lancamento compartilhado nao encontrado.', 404, 'SHARED_ENTRY_NOT_FOUND')

    const familyGroupId = String(current.family_group_id)
    const membership = await requireSharedEntryWriter(user.id, familyGroupId)
    const canManage = ['owner', 'admin'].includes(String(membership.role))
    if (!canManage && current.created_by !== user.id) {
      fail('Somente o criador, owner ou admin podem editar este lancamento.', 403, 'FORBIDDEN')
    }

    const currentParticipants = await serviceRestRequest(
      `shared_entry_participants?select=user_id&shared_entry_id=eq.${encodeURIComponent(sharedEntryId)}`,
    ) as Array<Record<string, unknown>>
    const explicitParticipants = userIdsFromBody(body.participant_user_ids || body.participantUserIds)
    const merged = {
      family_group_id: familyGroupId,
      type: body.type ?? current.type,
      description: body.description ?? current.description,
      amount: body.amount ?? current.amount,
      category: body.category ?? current.category,
      entry_date: body.entry_date ?? body.entryDate ?? current.entry_date,
      split_method: body.split_method ?? body.splitMethod ?? current.split_method,
      paid_by_user_id: body.paid_by_user_id ?? body.paidByUserId ?? current.paid_by_user_id,
      participant_user_ids: explicitParticipants.length
        ? explicitParticipants
        : currentParticipants.map((participant) => String(participant.user_id)),
      notes: body.notes ?? current.notes,
    }
    const activeMemberships = await listActiveMemberships(familyGroupId)
    const input = normalizeSharedEntryInput(merged, user.id, activeMemberships)
    const paidByUserId = input.split_method === 'paid_by_me' ? user.id : input.paid_by_user_id
    await assertActiveParticipants(familyGroupId, [...input.participant_user_ids, paidByUserId])

    const updatedRows = await serviceRestRequest(`shared_entries?id=eq.${encodeURIComponent(sharedEntryId)}&select=id,family_group_id,created_by,paid_by_user_id,type,description,amount,category,entry_date,split_method,notes,source,created_at,updated_at`, {
      method: 'PATCH',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify({
        paid_by_user_id: paidByUserId,
        type: input.type,
        description: input.description,
        amount: input.amount,
        category: input.category,
        entry_date: input.entry_date,
        split_method: input.split_method,
        notes: input.notes,
      }),
    }) as Array<Record<string, unknown>>
    await serviceRestRequest(`shared_entry_participants?shared_entry_id=eq.${encodeURIComponent(sharedEntryId)}`, { method: 'DELETE' })
    const participantRows = calculateParticipants(input.amount, input.participant_user_ids, input.split_method)
      .map((participant) => ({ ...participant, shared_entry_id: sharedEntryId }))
    const participants = await serviceRestRequest('shared_entry_participants?select=id,shared_entry_id,user_id,allocation_type,allocation_value,calculated_amount,created_at', {
      method: 'POST',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify(participantRows),
    }) as Array<Record<string, unknown>>

    await auditFamily(user.id, 'shared_entry_updated', 'shared_entry', {
      resource_id: sharedEntryId,
      metadata: { family_group_id: familyGroupId },
    })
    const entry = updatedRows?.[0] || null
    await notifyFamilyMembersOfSharedEntry({
      familyGroupId,
      actorUserId: user.id,
      entry,
      action: 'shared_entry_updated',
    })
    return jsonResponse({
      entry: entry && {
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
