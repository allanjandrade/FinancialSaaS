import { describe, expect, it } from 'vitest'
import { buildAdminAuditLog } from '@/domain/admin/audit.js'

describe('Release 10 admin audit log', () => {
  it('creates sanitized audit logs without secrets', () => {
    const log = buildAdminAuditLog({
      actor_user_id: 'admin-1',
      target_user_id: 'user-1',
      action: 'admin_invited_tester',
      resource_type: 'tester_invite',
      metadata: { email: 'tester@example.com', token: 'secret', nested: { authorization: 'Bearer x', group: 'release10' } },
    })

    expect(log.metadata.email).toBe('tester@example.com')
    expect(log.metadata.token).toBeUndefined()
    expect(log.metadata.nested.authorization).toBeUndefined()
  })
})
