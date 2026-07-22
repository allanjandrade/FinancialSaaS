import assert from 'node:assert/strict'
import { resolveAdminAccess, canAccessAdminPanel } from '../src/domain/admin/access.js'
import { createTesterInvite, acceptTesterInvite } from '../src/domain/admin/testers.js'
import { buildAdminAuditLog } from '../src/domain/admin/audit.js'
import { resolveEntitlements } from '../src/domain/billing/entitlements.js'

const admin = resolveAdminAccess({ active: true, role: 'admin' })
assert.equal(canAccessAdminPanel(admin), true)
assert.equal(canAccessAdminPanel({ is_admin: false, role: 'user' }), false)
const { invite, token } = createTesterInvite({ email: 'tester@example.com', token: 'opaque-token', access_expires_at: '2026-07-20T00:00:00Z' })
assert.equal(invite.token, undefined)
const accepted = acceptTesterInvite(invite, token, 'tester-user', new Date('2026-06-20T00:00:00Z'))
const entitlements = resolveEntitlements({ tester: accepted.tester }, new Date('2026-06-20T00:00:00Z'))
assert.equal(entitlements.features.predictive_advisor, true)
const expired = resolveEntitlements({ tester: accepted.tester }, new Date('2026-08-01T00:00:00Z'))
assert.equal(expired.features.predictive_advisor, false)
const audit = buildAdminAuditLog({ actor_user_id: 'admin', action: 'admin_invited_tester', resource_type: 'tester_invite', metadata: { token: 'secret', email: 'tester@example.com' } })
assert.equal(audit.metadata.token, undefined)
console.log('Release 10 admin/testers local smoke: PASS')
