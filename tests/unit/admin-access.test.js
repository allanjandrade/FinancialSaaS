import { describe, expect, it } from 'vitest'
import { canAccessAdminPanel, canPerformAdminAction, rejectForgedAdminPayload, resolveAdminAccess } from '@/domain/admin/access.js'

describe('Release 10 admin access', () => {
  it('blocks user/tester and allows support with limited permissions', () => {
    expect(canAccessAdminPanel(resolveAdminAccess(null))).toBe(false)
    expect(canAccessAdminPanel({ is_admin: false, role: 'tester' })).toBe(false)
    const support = resolveAdminAccess({ active: true, role: 'support' })
    expect(canAccessAdminPanel(support)).toBe(true)
    expect(canPerformAdminAction(support, 'set_feature_override')).toBe(false)
  })

  it('rejects frontend-controlled role and subscription fields', () => {
    expect(() => rejectForgedAdminPayload({ role: 'owner' })).toThrow('Campo controlado')
    expect(() => rejectForgedAdminPayload({ subscription_status: 'active' })).toThrow('Campo controlado')
  })
})
