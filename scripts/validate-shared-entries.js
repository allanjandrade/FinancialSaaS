import fs from 'node:fs'

function read(file) {
  return fs.readFileSync(file, 'utf8')
}

function assert(condition, message) {
  if (!condition) {
    console.error(`FAIL validate-shared-entries: ${message}`)
    process.exit(1)
  }
}

const migration = read('supabase/migrations/20260627130000_release113_family_sharing.sql')
const domain = read('src/domain/family/familySharing.js')
const createFn = read('supabase/functions/shared-entry-create/index.ts')
const updateFn = read('supabase/functions/shared-entry-update/index.ts')
const listFn = read('supabase/functions/shared-entry-list/index.ts')
const familyView = read('src/views/Family.vue')
const entriesView = read('src/views/Entries.vue')
const reportsView = read('src/views/Reports.vue')
const dashboardView = read('src/views/Home.vue')

assert(migration.includes('create table if not exists public.shared_entries'), 'shared_entries ausente')
assert(migration.includes('create table if not exists public.shared_entry_participants'), 'shared_entry_participants ausente')
assert(migration.includes('unique (shared_entry_id, user_id)'), 'participante pode duplicar no mesmo lancamento')
assert(migration.includes("split_method in ('equal', 'paid_by_me', 'paid_by_other', 'visible_only', 'percent', 'fixed')"), 'metodos de split incompletos')
assert(migration.includes('deleted_at timestamptz'), 'soft delete ausente')

assert(domain.includes('calculateSharedEntryParticipants'), 'calculo de split ausente')
assert(domain.includes("splitMethod === 'visible_only'"), 'visible_only nao preserva impacto zero')
assert(domain.includes('familyDashboardAmount'), 'visao individual/familia ausente')
assert(createFn.includes('calculateParticipants'), 'backend nao calcula participantes')
assert(createFn.includes('requireSharedEntryWriter'), 'create nao valida permissao de escrita')
assert(updateFn.includes('currentParticipants'), 'update nao preserva/recalcula participantes')
assert(listFn.includes('my_amount') && listFn.includes('family_total'), 'list nao retorna impacto individual e total familiar')
assert(!createFn.includes('finance_states') && !updateFn.includes('finance_states') && !listFn.includes('finance_states'), 'shared_entries nao deve tocar finance_states')

assert(familyView.includes('data-testid="family-shared-entry-form"'), 'UI sem formulario compartilhado')
assert(familyView.includes('data-testid="family-shared-entry-list"'), 'UI sem lista compartilhada')
assert(entriesView.includes('data-testid="entry-sharing-section"'), 'form de lancamento sem secao de compartilhamento')
assert(entriesView.includes('Privado por padrao'), 'form de lancamento nao deixa privacidade explicita')
assert(reportsView.includes('data-testid="family-dashboard-mode"'), 'relatorios sem alternancia minha/familia')
assert(dashboardView.includes('data-testid="family-dashboard-mode"'), 'dashboard sem alternancia minha/familia')

console.log('PASS validate-shared-entries')
