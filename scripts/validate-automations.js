import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { release2FinancialState } from '../tests/fixtures/release2-financial-state.js'
import {
  validateAutomationActionPayload,
  validateTemplateParameters,
} from '../supabase/functions/_shared/automations/schemas.js'
import { evaluateAutomationTemplate } from '../supabase/functions/_shared/automations/evaluators.js'
import {
  buildAutomationDedupeKey,
  buildNotificationPayload,
  isInCooldown,
  normalizeRunResult,
} from '../supabase/functions/_shared/automations/runner.js'

const root = process.cwd()
const requiredFiles = [
  'supabase/migrations/20260618143000_release5_automations.sql',
  'supabase/functions/automation-config/index.ts',
  'supabase/functions/run-automations/index.ts',
  'supabase/functions/_shared/automations/schemas.js',
  'supabase/functions/_shared/automations/evaluators.js',
  'supabase/functions/_shared/automations/runner.js',
  'src/api/automations.js',
  'src/views/Automations.vue',
]

for (const file of requiredFiles) {
  assert.ok(fs.existsSync(path.join(root, file)), `Arquivo obrigatorio ausente: ${file}`)
}

const migration = fs.readFileSync(path.join(root, requiredFiles[0]), 'utf8')
const grantMigration = fs.readFileSync(
  path.join(root, 'supabase/migrations/20260618165000_release5_executor_read_grants.sql'),
  'utf8',
)
for (const token of [
  'automation_templates',
  'user_automations',
  'automation_runs',
  'in_app_notifications',
  'claim_due_automations',
  'for update skip locked',
  'enable row level security',
]) {
  assert.ok(migration.toLowerCase().includes(token), `Contrato SQL ausente: ${token}`)
}

assert.deepEqual(validateTemplateParameters('card_bill_ratio_above', { ratio: 0.35 }), { ratio: 0.35 })
assert.throws(() => validateAutomationActionPayload({
  action: 'create_automation',
  template_id: 'cash_balance_below',
  name: 'Saldo',
  parameters: { threshold: 100, code: 'return true' },
}), /Campo perigoso/)
assert.throws(() => validateAutomationActionPayload({
  action: 'create_automation',
  template_id: 'cash_balance_below',
  name: 'Saldo',
  parameters: { threshold: 100, whatsapp: '+5511999999999' },
}), /Campo perigoso/)
assert.throws(() => validateAutomationActionPayload({
  action: 'create_automation',
  template_id: 'cash_balance_below',
  name: 'Saldo',
  parameters: { threshold: 100 },
  user_id: 'forged',
}), /Campo perigoso/)

const financeData = release2FinancialState()
const before = JSON.stringify(financeData)
const evaluation = evaluateAutomationTemplate('card_bill_ratio_above', { ratio: 0.2 }, financeData, {
  referenceDate: '2026-06-18',
})
assert.equal(evaluation.status, 'success')
assert.equal(evaluation.triggered, true)
assert.equal(JSON.stringify(financeData), before, 'Avaliador nao pode alterar estado financeiro.')

const automation = {
  id: '11111111-1111-4111-8111-111111111111',
  user_id: '22222222-2222-4222-8222-222222222222',
  template_id: 'card_bill_ratio_above',
  name: 'Fatura alta',
  cadence: 'daily',
}
const keyA = buildAutomationDedupeKey(automation, evaluation, new Date('2026-06-18T10:00:00Z'))
const keyB = buildAutomationDedupeKey(automation, evaluation, new Date('2026-06-18T18:00:00Z'))
assert.equal(keyA, keyB, 'Dedupe deve ser estavel dentro da janela controlada.')
assert.equal(isInCooldown('2026-06-18T10:00:00Z', 24, new Date('2026-06-18T12:00:00Z')), true)
assert.equal(normalizeRunResult(evaluation, true).resultPayload.code, 'COOLDOWN_ACTIVE')

const notification = buildNotificationPayload(automation, evaluation, '33333333-3333-4333-8333-333333333333')
assert.equal(notification.source, 'automation')
assert.equal(notification.source_id, '33333333-3333-4333-8333-333333333333')
assert.ok(!('email_to' in notification))
assert.ok(!('phone_number' in notification))
assert.ok(!('webhook_url' in notification))
assert.ok(grantMigration.includes('grant select on public.finance_states to service_role'))
assert.ok(grantMigration.includes('grant select on public.family_members to service_role'))
assert.ok(!grantMigration.includes('update on public.finance_states'))
assert.ok(!grantMigration.includes('insert on public.finance_states'))
assert.ok(!grantMigration.includes('delete on public.finance_states'))
assert.ok(!grantMigration.includes('all on public.finance_states'))

console.log('Automations validation: PASS')
