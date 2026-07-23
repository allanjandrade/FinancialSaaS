import fs from 'node:fs'

const requiredFiles = [
  'supabase/migrations/20260627130000_release113_family_sharing.sql',
  'supabase/functions/family-create-group/index.ts',
  'supabase/functions/family-send-invite/index.ts',
  'supabase/functions/family-accept-invite/index.ts',
  'supabase/functions/family-decline-invite/index.ts',
  'supabase/functions/family-remove-member/index.ts',
  'supabase/functions/family-update-member-role/index.ts',
  'supabase/functions/family-invite-preview/index.ts',
  'src/domain/family/familySharing.js',
  'src/views/Family.vue',
  'src/views/FamilyInvite.vue',
]

function read(file) {
  return fs.readFileSync(file, 'utf8')
}

function assert(condition, message) {
  if (!condition) {
    console.error(`FAIL validate-family-sharing: ${message}`)
    process.exit(1)
  }
}

for (const file of requiredFiles) {
  assert(fs.existsSync(file), `${file} ausente`)
}

const migration = read(requiredFiles[0])
const family = read('src/views/Family.vue')
const invite = read('src/views/FamilyInvite.vue')
const domain = read('src/domain/family/familySharing.js')
const pkg = JSON.parse(read('package.json'))
const api = read('src/api/family-supabase.js')
const router = read('src/router/index.js')

assert(migration.includes('create table if not exists public.family_groups'), 'family_groups nao criada')
assert(migration.includes('create table if not exists public.family_memberships'), 'family_memberships nao criada')
assert(migration.includes('add column if not exists token_hash'), 'convite sem token_hash')
assert(migration.includes('alter column token drop default'), 'convites novos ainda podem gerar token cru')
assert(migration.includes('alter column token drop not null'), 'coluna token antiga nao foi tornada opcional')

assert(family.includes('data-testid="family-sharing-page"'), 'pagina familiar compartilhada ausente')
assert(family.includes('data-testid="family-invite-form"'), 'formulario de convite ausente')
assert(family.includes('data-testid="family-shared-entry-form"'), 'formulario de lancamento compartilhado ausente')
assert(family.includes('data-testid="family-shared-entry-list"'), 'lista de lancamentos compartilhados ausente')
assert(family.includes('Dados privados continuam privados'), 'copy de privacidade ausente')
assert(invite.includes('acceptFamilyInvite') && invite.includes('declineFamilyInvite'), 'rota de aceite/recusa incompleta')
assert(router.includes("path: '/family/invite/:token'"), 'rota /family/invite/:token ausente')

assert(domain.includes('calculateSharedEntryParticipants'), 'calculo de participantes ausente no dominio')
assert(domain.includes('familyDashboardAmount'), 'calculo de visao minha/familia ausente')
assert(domain.includes("'family-create-group'"), 'cliente nao chama family-create-group')
assert(domain.includes("'shared-entry-create'"), 'cliente nao chama shared-entry-create')
assert(!api.includes(".from('family_invites')\n    .insert"), 'frontend legado ainda insere convite direto')

for (const script of ['validate:family-sharing', 'validate:family-rls', 'validate:shared-entries', 'smoke:family-sharing']) {
  assert(pkg.scripts?.[script], `script ${script} ausente`)
}

for (const fn of requiredFiles.filter((file) => file.startsWith('supabase/functions/'))) {
  const source = read(fn)
  assert(source.includes('requireAuthenticatedUser'), `${fn} nao valida sessao`)
  assert(source.includes('rejectControlledIdentity') || source.includes('rejectControlledIdentity'), `${fn} nao rejeita identidade no corpo`)
  assert(!source.includes('body.user_id') && !source.includes('body.userId'), `${fn} le user_id do corpo`)
}

console.log('PASS validate-family-sharing')
