import assert from 'node:assert/strict'
import fs from 'node:fs'
import { acceptTesterInvite, createTesterInvite } from '../src/domain/admin/testers.js'

const { invite, token } = createTesterInvite({ email: 'tester@example.com', token: 'opaque-token', access_expires_at: '2026-07-20T00:00:00Z' })
assert.equal(invite.token, undefined)
assert.equal(acceptTesterInvite(invite, token, 'user-1', new Date('2026-06-20T00:00:00Z')).tester.status, 'active')
for (const file of ['supabase/functions/tester-accept-invite/index.ts', 'supabase/functions/tester-status/index.ts']) {
  assert.ok(fs.existsSync(file), `Arquivo tester ausente: ${file}`)
}
console.log('Tester access validation: PASS')
