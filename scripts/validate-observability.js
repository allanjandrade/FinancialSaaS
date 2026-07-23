import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { normalizeSystemEvent, sanitizeMetadata } from '../supabase/functions/_shared/observability/logger.js'
import { rolloutEnabled } from '../supabase/functions/_shared/observability/flags.js'

const root = process.cwd()
const required = [
  'supabase/migrations/20260618180000_release6_observability.sql',
  'supabase/functions/_shared/observability/logger.js',
  'supabase/functions/operational-insights/index.ts',
  'supabase/functions/health-check/index.ts',
  'src/api/operational-insights.js',
  'src/views/Operational.vue',
]

for (const file of required) {
  assert.ok(fs.existsSync(path.join(root, file)), `Arquivo obrigatorio ausente: ${file}`)
}

const migration = fs.readFileSync(path.join(root, required[0]), 'utf8')
for (const token of [
  'system_events',
  'user_operation_limits',
  'feature_flags',
  'operational_panel_enabled',
  'diagnostics_export_enabled',
  'enable row level security',
]) {
  assert.ok(migration.toLowerCase().includes(token), `Contrato SQL ausente: ${token}`)
}
assert.ok(!/grant\s+all\s+on\s+public\.finance_states/i.test(migration), 'Release 6 nao pode conceder escrita financeira ampla.')

const metadata = sanitizeMetadata({
  access_token: 'secret',
  jwt: 'secret',
  raw_prompt: 'prompt completo',
  nested: { password: 'secret', safe: 'ok' },
})
const serializedMetadata = JSON.stringify(metadata)
assert.equal(serializedMetadata.includes('secret'), false)
assert.equal(serializedMetadata.includes('prompt completo'), false)
assert.equal(metadata.nested.safe, 'ok')

const event = normalizeSystemEvent({
  source: 'frontend',
  eventType: 'diagnostics_exported',
  metadata: { full_finance_state: { expenses: [{ amount: 1 }] }, visible: true },
})
assert.equal(event.source, 'frontend')
assert.equal(event.event_type, 'diagnostics_exported')
assert.equal(event.metadata.visible, true)
assert.equal(JSON.stringify(event).includes('expenses'), false)

assert.equal(rolloutEnabled({ key: 'x', enabled: false, rollout_percentage: 100 }, 'user'), false)
assert.equal(rolloutEnabled({ key: 'x', enabled: true, rollout_percentage: 100 }, 'user'), true)

const operational = fs.readFileSync(path.join(root, 'supabase/functions/operational-insights/index.ts'), 'utf8')
for (const token of [
  'requireAuthenticatedUser',
  'rejectIdentityOverride',
  'periodDays > 90',
  'exportDiagnostics',
  'diagnostics_exported',
  'assertFeatureEnabled',
  'assertOperationLimit',
]) {
  assert.ok(operational.includes(token), `operational-insights sem protecao: ${token}`)
}
assert.ok(!operational.includes('transactions:'))
assert.ok(!operational.includes('finance_states?select=data'))

const health = fs.readFileSync(path.join(root, 'supabase/functions/health-check/index.ts'), 'utf8')
assert.ok(health.includes("version: 'release-11'") || health.includes('version: "release-11"'))
for (const token of ['auth', 'db', 'feature_flags', 'automations', 'ai_actions', 'observability', 'entitlements', 'billing']) {
  assert.ok(health.includes(token), `Health-check sem status agregado: ${token}`)
}
assert.ok(!health.includes('transactions:'))
assert.ok(!health.includes('finance_states?select=data'))
assert.ok(!health.includes('SUPABASE_SERVICE_ROLE_KEY,'))

console.log('Observability validation: PASS')
