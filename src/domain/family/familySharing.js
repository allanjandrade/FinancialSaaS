import { getSupabaseClient } from '@/lib/supabase-client.js'
import {
  friendlySupabaseError,
  getActiveSession,
  invokeAuthenticatedFunction,
} from '@/lib/supabase-auth.js'

export const FAMILY_ROLES = Object.freeze([
  { value: 'owner', label: 'Owner' },
  { value: 'admin', label: 'Admin' },
  { value: 'member', label: 'Membro' },
  { value: 'read_only', label: 'Somente leitura' },
])

export const INVITABLE_FAMILY_ROLES = Object.freeze(FAMILY_ROLES.filter((role) => role.value !== 'owner'))

export const SHARED_SPLIT_METHODS = Object.freeze([
  { value: 'equal', label: 'Dividir igualmente' },
  { value: 'paid_by_me', label: 'Pago por mim' },
  { value: 'paid_by_other', label: 'Pago por outro membro' },
  { value: 'visible_only', label: 'Apenas visivel' },
])

export function canManageFamilyRole(role) {
  return ['owner', 'admin'].includes(String(role || ''))
}

export function canWriteSharedEntries(role) {
  return ['owner', 'admin', 'member'].includes(String(role || ''))
}

export function familyRoleLabel(role) {
  return FAMILY_ROLES.find((item) => item.value === role)?.label || 'Membro'
}

export function splitMethodLabel(method) {
  return SHARED_SPLIT_METHODS.find((item) => item.value === method)?.label || 'Dividir igualmente'
}

export function normalizeMoney(value) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

export function calculateSharedEntryParticipants(amount, userIds = [], splitMethod = 'equal') {
  const uniqueUserIds = [...new Set(userIds.map(String).filter(Boolean))]
  if (!uniqueUserIds.length) return []
  if (splitMethod === 'visible_only') {
    return uniqueUserIds.map((userId) => ({
      user_id: userId,
      allocation_type: 'visible_only',
      allocation_value: null,
      calculated_amount: 0,
    }))
  }
  const totalCents = Math.round(normalizeMoney(amount) * 100)
  const base = Math.floor(totalCents / uniqueUserIds.length)
  const remainder = totalCents - base * uniqueUserIds.length
  return uniqueUserIds.map((userId, index) => ({
    user_id: userId,
    allocation_type: 'equal',
    allocation_value: null,
    calculated_amount: (base + (index < remainder ? 1 : 0)) / 100,
  }))
}

export function familyDashboardAmount(entry, mode = 'mine', userId = '') {
  if (mode === 'family') return normalizeMoney(entry?.family_total ?? entry?.amount)
  const own = (entry?.participants || []).find((participant) => String(participant.user_id) === String(userId))
  return normalizeMoney(entry?.my_amount ?? own?.calculated_amount)
}

export function buildFamilyInviteRoute(token) {
  return `/family/invite/${encodeURIComponent(String(token || ''))}`
}

export function normalizeSharedEntryForm(input = {}, familyGroupId = '') {
  const participantUserIds = Array.isArray(input.participant_user_ids)
    ? input.participant_user_ids
    : Array.isArray(input.participantUserIds)
      ? input.participantUserIds
      : []
  return {
    family_group_id: input.family_group_id || input.familyGroupId || familyGroupId,
    type: input.type || 'expense',
    description: String(input.description || '').trim(),
    amount: normalizeMoney(input.amount),
    category: String(input.category || '').trim() || null,
    entry_date: input.entry_date || input.entryDate || new Date().toISOString().slice(0, 10),
    split_method: input.split_method || input.splitMethod || 'equal',
    paid_by_user_id: input.paid_by_user_id || input.paidByUserId || '',
    participant_user_ids: [...new Set(participantUserIds.map(String).filter(Boolean))],
    notes: String(input.notes || '').trim() || null,
  }
}

async function invokeFamilyFunction(name, body = {}) {
  const { data, error, skipped } = await invokeAuthenticatedFunction(name, { body }, { timeoutMs: 6500, attempts: 2 })
  if (skipped) throw new Error('Faca login para continuar.')
  if (error) throw new Error(friendlySupabaseError(error, 'Não foi possível concluir a ação.'))
  return data || {}
}

async function currentUser(supabase) {
  const { user, error } = await getActiveSession(supabase)
  if (error) throw error
  return user || null
}

function firstRow(data) {
  if (Array.isArray(data)) return data[0] || null
  return data || null
}

export async function fetchFamilySharingOverview() {
  const supabase = getSupabaseClient()
  if (!supabase) return emptyFamilySharingOverview()
  const user = await currentUser(supabase)
  if (!user?.id) return emptyFamilySharingOverview()

  const { data: myMemberships, error: membershipError } = await supabase
    .from('family_memberships')
    .select('id,family_group_id,user_id,role,status,joined_at')
    .eq('user_id', user.id)
    .eq('status', 'active')
    .limit(1)
  if (membershipError) throw membershipError

  const myMembership = firstRow(myMemberships)
  if (!myMembership?.family_group_id) return { ...emptyFamilySharingOverview(), user }

  const familyGroupId = myMembership.family_group_id
  const [{ data: groups, error: groupError }, { data: memberships, error: membersError }, { data: invites, error: invitesError }] = await Promise.all([
    supabase
      .from('family_groups')
      .select('id,name,owner_user_id,created_at,updated_at')
      .eq('id', familyGroupId)
      .is('deleted_at', null)
      .limit(1),
    supabase
      .from('family_memberships')
      .select('id,family_group_id,user_id,role,status,joined_at,created_at')
      .eq('family_group_id', familyGroupId)
      .order('created_at', { ascending: true }),
    supabase
      .from('family_invites')
      .select('id,family_group_id,invited_email,email,role,status,expires_at,created_at')
      .eq('family_group_id', familyGroupId)
      .in('status', ['pending', 'Pendente']),
  ])
  if (groupError) throw groupError
  if (membersError) throw membersError
  if (invitesError) throw invitesError

  const shared = await listSharedEntries(familyGroupId).catch(() => ({ entries: [] }))
  return {
    user,
    family: firstRow(groups),
    myMembership,
    memberships: memberships || [],
    invites: invites || [],
    sharedEntries: shared.entries || [],
  }
}

export async function fetchPendingFamilyInvites() {
  const result = await invokeFamilyFunction('family-pending-invites', {})
  return result.invites || []
}

export function emptyFamilySharingOverview() {
  return {
    user: null,
    family: null,
    myMembership: null,
    memberships: [],
    invites: [],
    sharedEntries: [],
  }
}

export const createFamilyGroup = (name) => invokeFamilyFunction('family-create-group', { name })

export const sendFamilyInvite = ({ familyGroupId, email, role, message }) =>
  invokeFamilyFunction('family-send-invite', {
    family_group_id: familyGroupId,
    email,
    role,
    message,
  })

export const acceptFamilyInvite = (token) => invokeFamilyFunction('family-accept-invite', { token })

export const declineFamilyInvite = (token) => invokeFamilyFunction('family-decline-invite', { token })

export const acceptFamilyInviteById = (inviteId) => invokeFamilyFunction('family-accept-invite', { invite_id: inviteId })

export const declineFamilyInviteById = (inviteId) => invokeFamilyFunction('family-decline-invite', { invite_id: inviteId })

export const previewFamilyInvite = (token) => invokeFamilyFunction('family-invite-preview', { token })

export const removeFamilyMember = ({ familyGroupId, membershipId }) =>
  invokeFamilyFunction('family-remove-member', {
    family_group_id: familyGroupId,
    membership_id: membershipId,
  })

export const updateFamilyMemberRole = ({ familyGroupId, membershipId, role }) =>
  invokeFamilyFunction('family-update-member-role', {
    family_group_id: familyGroupId,
    membership_id: membershipId,
    role,
  })

export const createSharedEntry = (input) =>
  invokeFamilyFunction('shared-entry-create', normalizeSharedEntryForm(input, input.family_group_id || input.familyGroupId))

export const updateSharedEntry = (input) =>
  invokeFamilyFunction('shared-entry-update', {
    shared_entry_id: input.shared_entry_id || input.sharedEntryId,
    ...normalizeSharedEntryForm(input, input.family_group_id || input.familyGroupId),
  })

export const deleteSharedEntry = (sharedEntryId) =>
  invokeFamilyFunction('shared-entry-delete', { shared_entry_id: sharedEntryId })

export const listSharedEntries = (familyGroupId) =>
  invokeFamilyFunction('shared-entry-list', { family_group_id: familyGroupId })
