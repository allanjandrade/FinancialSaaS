import { createHash } from 'node:crypto'

export function hashInviteToken(token) {
  return createHash('sha256').update(String(token || '')).digest('hex')
}

export function createTesterInvite({ email, tester_group = 'default', access_expires_at, created_by, now = new Date(), token = null } = {}) {
  if (!String(email || '').includes('@')) throw new Error('email invalido')
  const rawToken = token || createOpaqueToken()
  const expiresAt = access_expires_at || new Date(new Date(now).getTime() + 14 * 86400000).toISOString()
  return {
    invite: {
      email: String(email).toLowerCase(),
      invite_token_hash: hashInviteToken(rawToken),
      status: 'pending',
      tester_group,
      access_expires_at: expiresAt,
      expires_at: expiresAt,
      created_by,
    },
    token: rawToken,
  }
}

export function acceptTesterInvite(invite, token, userId, now = new Date()) {
  if (!invite || invite.status !== 'pending') throw new Error('Convite indisponível.')
  if (invite.invite_token_hash !== hashInviteToken(token)) throw new Error('token invalido')
  if (new Date(invite.expires_at).getTime() <= new Date(now).getTime()) throw new Error('convite expirado')
  return {
    invite: { ...invite, status: 'accepted', accepted_by: userId, accepted_at: new Date(now).toISOString() },
    tester: {
      user_id: userId,
      status: 'active',
      tester_group: invite.tester_group || 'default',
      access_expires_at: invite.access_expires_at || invite.expires_at,
    },
  }
}

export function revokeTester(tester, actorUserId) {
  return { ...tester, status: 'revoked', revoked_by: actorUserId, updated_at: new Date().toISOString() }
}

function createOpaqueToken() {
  return [...crypto.getRandomValues(new Uint8Array(24))].map((byte) => byte.toString(16).padStart(2, '0')).join('')
}
