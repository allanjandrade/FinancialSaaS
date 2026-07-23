import assert from 'node:assert/strict'
import fs from 'node:fs'

const migrations = fs.readdirSync('supabase/migrations')
  .filter((file) => file.endsWith('.sql'))
  .map((file) => fs.readFileSync(`supabase/migrations/${file}`, 'utf8'))
  .join('\n')

for (const table of [
  'finance_states',
  'family_members',
  'ai_action_drafts',
  'ai_action_logs',
  'automation_templates',
  'user_automations',
  'automation_runs',
  'in_app_notifications',
  'system_events',
  'price_search_cache',
]) {
  assert.match(migrations, new RegExp(`alter table public\\.${table} enable row level security`, 'i'), `RLS ausente em ${table}`)
}

const cacheMigration = fs.readFileSync('supabase/migrations/20260620100000_price_search_cache_valueserp.sql', 'utf8')
assert.ok(cacheMigration.includes('auth.uid() = user_id'), 'price_search_cache precisa isolar por usuario.')
assert.ok(cacheMigration.includes('grant all on public.price_search_cache to service_role'), 'service_role precisa operar cache somente no backend.')

const userIsolationMigration = fs.readFileSync('supabase/migrations/20260621110000_hotfix_p0_user_isolation.sql', 'utf8')
assert.ok(userIsolationMigration.includes('add column if not exists user_id'), 'finance_states precisa ter user_id.')
assert.ok(/alter table public\.finance_states force row level security/i.test(userIsolationMigration), 'finance_states precisa FORCE RLS.')
assert.ok(/using \(\(select auth\.uid\(\)\) = user_id\)/i.test(userIsolationMigration), 'finance_states precisa policy own por auth.uid.')
assert.ok(/where family_id = v_draft\.family_id\s+and user_id = p_user_id/i.test(userIsolationMigration), 'commit_ai_action precisa filtrar por user_id.')
assert.ok(/where family_id = v_log\.family_id\s+and user_id = p_user_id/i.test(userIsolationMigration), 'revert_ai_action precisa filtrar por user_id.')

const financePolicyCleanup = fs.readFileSync('supabase/migrations/20260621114000_hotfix_p0_finance_states_policy_cleanup.sql', 'utf8')
assert.ok(
  financePolicyCleanup.includes('Enable all access for authenticated users') &&
    financePolicyCleanup.includes('policyname not in') &&
    financePolicyCleanup.includes('finance states select own'),
  'finance_states precisa limpar policies amplas/legadas antes de recriar policies own.',
)
assert.doesNotMatch(
  migrations,
  /create policy\s+"[^"]*all access[^"]*"\s+on public\.finance_states[\s\S]+auth\.role\(\)\s*=\s*'authenticated'/i,
  'finance_states nao pode ter policy ampla para qualquer usuario autenticado.',
)

const forbiddenUserIdMigration = fs.readFileSync('supabase/migrations/20260621115000_hotfix_p0_finance_states_forbidden_user_id.sql', 'utf8')
assert.ok(
  forbiddenUserIdMigration.includes("using errcode = '42501'"),
  'finance_states deve responder forbidden ao receber user_id diferente do JWT.',
)

const confirmAction = fs.readFileSync('supabase/functions/confirm-action/index.ts', 'utf8')
const revertAction = fs.readFileSync('supabase/functions/revert-action/index.ts', 'utf8')
assert.ok(confirmAction.includes('rejectIdentityOverride') || confirmAction.includes('user_id'), 'confirm-action precisa bloquear user_id forjado.')
assert.ok(revertAction.includes('rejectIdentityOverride') || revertAction.includes('user_id'), 'revert-action precisa bloquear user_id forjado.')

console.log('RLS security validation: PASS')
