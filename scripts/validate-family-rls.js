import fs from 'node:fs'

const migrationPath = 'supabase/migrations/20260627130000_release113_family_sharing.sql'
const sql = fs.readFileSync(migrationPath, 'utf8')

function assert(condition, message) {
  if (!condition) {
    console.error(`FAIL validate-family-rls: ${message}`)
    process.exit(1)
  }
}

for (const table of ['family_groups', 'family_memberships', 'shared_entries', 'shared_entry_participants']) {
  assert(sql.includes(`alter table public.${table} enable row level security`), `${table} sem RLS`)
  assert(sql.includes(`alter table public.${table} force row level security`), `${table} sem FORCE RLS`)
}

assert(sql.includes('create or replace function public.is_family_member(target_family_group_id uuid)'), 'helper is_family_member ausente')
assert(sql.includes("fm.status = 'active'"), 'membership ativa nao exigida no helper')
assert(sql.includes('create or replace function public.can_manage_family'), 'helper de admin ausente')
assert(sql.includes('create or replace function public.can_write_shared_entry'), 'helper de escrita ausente')
assert(sql.includes('family_groups_select_members'), 'policy select family_groups ausente')
assert(sql.includes('family_memberships_select_members'), 'policy select family_memberships ausente')
assert(sql.includes('family_invites_select_group_members'), 'policy select family_invites ausente')
assert(sql.includes('shared_entries_select_members'), 'policy select shared_entries ausente')
assert(sql.includes('shared_entries_insert_members'), 'policy insert shared_entries ausente')
assert(sql.includes('created_by = auth.uid()'), 'insert shared_entries nao exige created_by da sessao')
assert(sql.includes('public.is_family_member(family_group_id)'), 'shared_entries nao checa membro da familia')
assert(sql.includes('exists (\n    select 1\n    from public.shared_entries se'), 'participantes nao sao protegidos por shared_entries')
assert(sql.includes('token_hash text unique'), 'token_hash unico ausente')
assert(sql.includes('alter column token drop default'), 'token cru antigo ainda tem default')

console.log('PASS validate-family-rls')
