import { EdgeAuthError } from './auth.ts'
import { authErrorResponse } from './cors.ts'
import { audit, authAdminRequest, randomToken, serviceRestRequest, sha256Hex } from './release10/rest.ts'

export const controlledIdentityFields = [
  'user_id',
  'userId',
  'owner_user_id',
  'ownerUserId',
  'created_by',
  'createdBy',
  'accepted_by',
  'acceptedBy',
  'updated_by',
  'updatedBy',
]

const writableRoles = new Set(['owner', 'admin', 'member'])
const managerRoles = new Set(['owner', 'admin'])
const inviteRoles = new Set(['admin', 'member', 'read_only'])
const entryTypes = new Set(['expense', 'income', 'note'])
const splitMethods = new Set(['equal', 'paid_by_me', 'paid_by_other', 'visible_only', 'percent', 'fixed'])

export function edgeErrorResponse(error: unknown) {
  const status = Number((error as { status?: number })?.status || (error instanceof EdgeAuthError ? error.status : 500))
  const code = String((error as { code?: string })?.code || (status === 400 ? 'BAD_REQUEST' : status === 404 ? 'NOT_FOUND' : status === 401 ? 'UNAUTHORIZED' : status === 403 ? 'FORBIDDEN' : 'SERVER_ERROR'))
  const message = error instanceof Error ? error.message : 'Nao foi possivel concluir a acao.'
  return authErrorResponse(code, message, status)
}

export function fail(message: string, status = 400, code = 'BAD_REQUEST'): never {
  throw Object.assign(new Error(message), { status, code })
}

export function rejectControlledIdentity(body: Record<string, unknown>, extraFields: string[] = []) {
  const fields = [...controlledIdentityFields, ...extraFields]
  const attempted = fields.find((field) => body?.[field] != null)
  if (attempted) {
    throw new EdgeAuthError(
      'A identidade do usuario e definida exclusivamente pela sessao autenticada.',
      403,
      'FORBIDDEN',
    )
  }
}

export function normalizeText(value: unknown, fallback = '') {
  return String(value ?? fallback).trim()
}

export function normalizeEmail(value: unknown) {
  const email = normalizeText(value).toLowerCase()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) fail('Informe um e-mail valido.', 400, 'INVALID_EMAIL')
  return email
}

export function normalizeInviteRole(value: unknown) {
  const role = normalizeText(value, 'member')
  if (!inviteRoles.has(role)) fail('Perfil de convite invalido.', 400, 'INVALID_ROLE')
  return role
}

export function normalizeEntryType(value: unknown) {
  const type = normalizeText(value, 'expense')
  if (!entryTypes.has(type)) fail('Tipo de lancamento compartilhado invalido.', 400, 'INVALID_ENTRY_TYPE')
  return type
}

export function normalizeSplitMethod(value: unknown) {
  const splitMethod = normalizeText(value, 'equal')
  if (!splitMethods.has(splitMethod)) fail('Metodo de divisao invalido.', 400, 'INVALID_SPLIT_METHOD')
  return splitMethod
}

export function assertUuid(value: unknown, label: string) {
  const id = normalizeText(value)
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) {
    fail(`${label} invalido.`, 400, 'INVALID_UUID')
  }
  return id
}

export async function getMembership(userId: string, familyGroupId: string) {
  const rows = await serviceRestRequest(
    `family_memberships?select=id,family_group_id,user_id,role,status,joined_at&family_group_id=eq.${encodeURIComponent(familyGroupId)}&user_id=eq.${encodeURIComponent(userId)}&status=eq.active&limit=1`,
  ) as Array<Record<string, unknown>>
  return rows?.[0] || null
}

export async function requireMembership(userId: string, familyGroupId: string) {
  const membership = await getMembership(userId, familyGroupId)
  if (!membership) fail('Voce nao participa desta familia.', 403, 'FORBIDDEN')
  return membership
}

export async function requireManager(userId: string, familyGroupId: string) {
  const membership = await requireMembership(userId, familyGroupId)
  if (!managerRoles.has(String(membership.role))) fail('Somente owner ou admin podem gerenciar esta familia.', 403, 'FORBIDDEN')
  return membership
}

export async function requireSharedEntryWriter(userId: string, familyGroupId: string) {
  const membership = await requireMembership(userId, familyGroupId)
  if (!writableRoles.has(String(membership.role))) fail('Seu acesso a familia e somente leitura.', 403, 'FORBIDDEN')
  return membership
}

export async function getFamilyGroup(familyGroupId: string) {
  const rows = await serviceRestRequest(
    `family_groups?select=id,name,owner_user_id,created_at,updated_at&deleted_at=is.null&id=eq.${encodeURIComponent(familyGroupId)}&limit=1`,
  ) as Array<Record<string, unknown>>
  return rows?.[0] || null
}

export async function listActiveMemberships(familyGroupId: string) {
  return await serviceRestRequest(
    `family_memberships?select=id,family_group_id,user_id,role,status,joined_at,created_at&family_group_id=eq.${encodeURIComponent(familyGroupId)}&status=eq.active&order=created_at.asc`,
  ) as Array<Record<string, unknown>>
}

export function userIdsFromBody(value: unknown) {
  if (!Array.isArray(value)) return []
  return [...new Set(value.map((item) => normalizeText(item)).filter(Boolean))]
}

export async function assertActiveParticipants(familyGroupId: string, userIds: string[]) {
  const memberships = await listActiveMemberships(familyGroupId)
  const active = new Set(memberships.map((membership) => String(membership.user_id)))
  const missing = userIds.find((userId) => !active.has(userId))
  if (missing) fail('Participante fora da familia ativa.', 403, 'PARTICIPANT_NOT_ALLOWED')
  return memberships
}

export function calculateParticipants(amount: number, userIds: string[], splitMethod = 'equal') {
  if (!userIds.length) fail('Selecione ao menos um participante.', 400, 'PARTICIPANTS_REQUIRED')
  if (splitMethod === 'visible_only') {
    return userIds.map((userId) => ({
      user_id: userId,
      allocation_type: 'visible_only',
      allocation_value: null,
      calculated_amount: 0,
    }))
  }

  const totalCents = Math.round(Number(amount || 0) * 100)
  const base = Math.floor(totalCents / userIds.length)
  const remainder = totalCents - base * userIds.length
  return userIds.map((userId, index) => ({
    user_id: userId,
    allocation_type: 'equal',
    allocation_value: null,
    calculated_amount: (base + (index < remainder ? 1 : 0)) / 100,
  }))
}

export function normalizeSharedEntryInput(body: Record<string, unknown>, currentUserId: string, activeMemberships: Array<Record<string, unknown>> = []) {
  const familyGroupId = assertUuid(body.family_group_id || body.familyGroupId, 'Familia')
  const amount = Number(body.amount)
  if (!Number.isFinite(amount) || amount < 0) fail('Informe um valor valido.', 400, 'INVALID_AMOUNT')
  const description = normalizeText(body.description)
  if (description.length < 2) fail('Informe uma descricao.', 400, 'INVALID_DESCRIPTION')
  const type = normalizeEntryType(body.type)
  const splitMethod = normalizeSplitMethod(body.split_method || body.splitMethod)
  const paidByUserId = assertUuid(body.paid_by_user_id || body.paidByUserId || currentUserId, 'Pagador')
  const participantInput = userIdsFromBody(body.participant_user_ids || body.participantUserIds)
  const participantUserIds = participantInput.length
    ? participantInput
    : activeMemberships.map((membership) => String(membership.user_id)).filter(Boolean)

  return {
    family_group_id: familyGroupId,
    type,
    description: description.slice(0, 180),
    amount,
    category: normalizeText(body.category) || null,
    entry_date: normalizeText(body.entry_date || body.entryDate) || new Date().toISOString().slice(0, 10),
    split_method: splitMethod,
    paid_by_user_id: paidByUserId,
    participant_user_ids: participantUserIds,
    notes: normalizeText(body.notes) || null,
  }
}

export async function createInviteRecord(input: {
  familyGroupId: string
  invitedBy: string
  invitedEmail: string
  role: string
  message?: string | null
}) {
  const token = randomToken()
  const tokenHash = await sha256Hex(token)
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
  const rows = await serviceRestRequest('family_invites?select=id,family_group_id,invited_email,role,status,expires_at,created_at', {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify({
      family_group_id: input.familyGroupId,
      invited_email: input.invitedEmail,
      email: input.invitedEmail,
      invited_by: input.invitedBy,
      role: input.role,
      token_hash: tokenHash,
      status: 'pending',
      method: 'link',
      expires_at: expiresAt,
      message: input.message || null,
    }),
  }) as Array<Record<string, unknown>>
  return { invite: rows?.[0] || null, token }
}

export async function findAuthUserByEmail(email: string) {
  const target = normalizeText(email).toLowerCase()
  if (!target) return null
  const page = await authAdminRequest('users?per_page=1000') as { users?: Array<{ id: string; email?: string }> }
  return page.users?.find((user) => normalizeText(user.email).toLowerCase() === target) || null
}

export async function createFamilyNotification(input: {
  userId: string
  sourceId?: string | null
  title: string
  message: string
  severity?: string
  payload?: Record<string, unknown>
}) {
  const rows = await serviceRestRequest('in_app_notifications?select=id,user_id,source,source_id,title,message,read_at,created_at', {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify({
      user_id: input.userId,
      source: 'family',
      source_id: input.sourceId || null,
      severity: input.severity || 'info',
      title: input.title,
      message: input.message,
      payload: input.payload || {},
    }),
  }) as Array<Record<string, unknown>>
  return rows?.[0] || null
}

export async function notifyExistingInvitedUser(input: {
  invitedEmail: string
  invitedBy: string
  family: Record<string, unknown>
  invite: Record<string, unknown> | null
}) {
  const invitedUser = await findAuthUserByEmail(input.invitedEmail).catch(() => null)
  if (!invitedUser?.id || invitedUser.id === input.invitedBy || !input.invite?.id) return null

  const alreadyMember = await getMembership(invitedUser.id, String(input.invite.family_group_id || '')).catch(() => null)
  if (alreadyMember) return null

  return await createFamilyNotification({
    userId: invitedUser.id,
    sourceId: String(input.invite.id),
    title: 'Convite familiar',
    message: `Voce foi convidado para ${normalizeText(input.family.name, 'uma familia')}.`,
    payload: {
      action: 'family_invite',
      invite_id: input.invite.id,
      family_group_id: input.invite.family_group_id,
    },
  }).catch(() => null)
}

export async function notifyFamilyMembersOfSharedEntry(input: {
  familyGroupId: string
  actorUserId: string
  entry: Record<string, unknown> | null
  action: 'shared_entry_created' | 'shared_entry_updated'
}) {
  if (!input.entry?.id) return []
  const actorUserId = input.actorUserId
  const memberships = await listActiveMemberships(input.familyGroupId)
  const recipients = memberships
    .filter((membership) => String(membership.user_id) !== String(actorUserId))
    .map((membership) => String(membership.user_id))
    .filter(Boolean)
  const actionLabel = input.action === 'shared_entry_created' ? 'criou' : 'alterou'
  const payloadAction = input.action === 'shared_entry_created'
    ? { action: 'shared_entry_created' }
    : { action: 'shared_entry_updated' }
  return await Promise.all(recipients.map((userId) => createFamilyNotification({
    userId,
    sourceId: String(input.entry?.id),
    title: 'Lancamento compartilhado',
    message: `Um membro ${actionLabel} "${normalizeText(input.entry?.description, 'lancamento compartilhado')}".`,
    payload: {
      ...payloadAction,
      shared_entry_id: input.entry?.id,
      family_group_id: input.familyGroupId,
    },
  }).catch(() => null)))
}

export async function findInviteByTokenOrId(body: Record<string, unknown>) {
  const token = normalizeText(body.token)
  if (token) {
    if (token.length < 20) fail('Convite indisponivel.', 403, 'FORBIDDEN')
    const hash = await sha256Hex(token)
    const rows = await serviceRestRequest(
      `family_invites?select=id,family_group_id,invited_email,email,role,status,expires_at&token_hash=eq.${hash}&limit=1`,
    ) as Array<Record<string, unknown>>
    return rows?.[0] || null
  }

  const inviteId = body.invite_id || body.inviteId
  const id = assertUuid(inviteId, 'Convite')
  const rows = await serviceRestRequest(
    `family_invites?select=id,family_group_id,invited_email,email,role,status,expires_at&id=eq.${encodeURIComponent(id)}&limit=1`,
  ) as Array<Record<string, unknown>>
  return rows?.[0] || null
}

export function assertInviteAvailableForUser(invite: Record<string, unknown> | null, user: { id: string; email?: string }) {
  if (!invite || invite.status !== 'pending') fail('Convite indisponivel.', 403, 'FORBIDDEN')
  if (new Date(String(invite.expires_at)).getTime() <= Date.now()) fail('Convite expirado.', 403, 'FORBIDDEN')
  const invitedEmail = normalizeText(invite.invited_email || invite.email).toLowerCase()
  const sessionEmail = normalizeText(user.email).toLowerCase()
  if (invitedEmail && sessionEmail && invitedEmail !== sessionEmail) {
    fail('Este convite foi enviado para outro e-mail.', 403, 'FORBIDDEN')
  }
}

export function buildInviteUrl(req: Request, token: string) {
  const configured = Deno.env.get('APP_URL') || Deno.env.get('SITE_URL') || Deno.env.get('VITE_APP_URL')
  const origin = configured || req.headers.get('origin') || Deno.env.get('SUPABASE_URL') || ''
  return `${origin.replace(/\/$/, '')}/family/invite/${token}`
}

export async function auditFamily(userId: string | null, action: string, resourceType: string, details: Record<string, unknown> = {}) {
  await audit(userId, action, resourceType, details).catch(() => undefined)
}
