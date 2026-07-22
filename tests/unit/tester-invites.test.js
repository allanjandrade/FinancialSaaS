import { describe, expect, it } from 'vitest'
import { acceptTesterInvite, createTesterInvite, hashInviteToken, revokeTester } from '@/domain/admin/testers.js'

describe('Release 10 tester invites', () => {
  it('stores only token hash and accepts valid invite once', () => {
    const { invite, token } = createTesterInvite({ email: 'tester@example.com', token: 'opaque-token', access_expires_at: '2026-07-20T00:00:00Z' })
    const accepted = acceptTesterInvite(invite, token, 'user-1', new Date('2026-06-20T00:00:00Z'))

    expect(invite.invite_token_hash).toBe(hashInviteToken('opaque-token'))
    expect(invite.token).toBeUndefined()
    expect(accepted.tester.status).toBe('active')
    expect(() => acceptTesterInvite(accepted.invite, token, 'user-1')).toThrow('Convite indisponível.')
  })

  it('rejects expired invite and revokes tester', () => {
    const { invite, token } = createTesterInvite({ email: 'tester@example.com', token: 'opaque-token', access_expires_at: '2026-06-01T00:00:00Z' })
    expect(() => acceptTesterInvite(invite, token, 'user-1', new Date('2026-06-20T00:00:00Z'))).toThrow('convite expirado')
    expect(revokeTester({ user_id: 'user-1', status: 'active' }, 'admin-1').status).toBe('revoked')
  })
})
