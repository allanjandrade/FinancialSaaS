import assert from 'node:assert/strict'
import fs from 'node:fs'
import { canAccessAdminPanel, resolveAdminAccess } from '../src/domain/admin/access.js'

assert.equal(canAccessAdminPanel(resolveAdminAccess(null)), false)
assert.equal(canAccessAdminPanel(resolveAdminAccess({ active: true, role: 'support' })), true)
for (const file of ['src/views/Admin.vue', 'supabase/functions/admin-current-user/index.ts', 'supabase/functions/admin-invite-tester/index.ts']) {
  assert.ok(fs.existsSync(file), `Arquivo admin ausente: ${file}`)
}
console.log('Admin access validation: PASS')
