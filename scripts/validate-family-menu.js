import assert from 'node:assert/strict'
import fs from 'node:fs'

const navigation = fs.readFileSync('src/router/navigation.js', 'utf8')
const router = fs.readFileSync('src/router/index.js', 'utf8')
const sidebar = fs.readFileSync('src/components/Sidebar.vue', 'utf8')
const family = fs.readFileSync('src/views/Family.vue', 'utf8')
const domain = fs.readFileSync('src/domain/family/userFamilyMembers.js', 'utf8')
const migration = fs.readFileSync('supabase/migrations/20260627110000_release112_production_readiness.sql', 'utf8')

assert.ok(navigation.includes("path: '/family'"), 'Menu precisa expor Familia.')
assert.ok(navigation.includes("label: 'Fam"), 'Menu precisa nomear Familia.')
assert.ok(sidebar.includes('family: Users'), 'Sidebar precisa ter icone de Familia.')
assert.ok(router.includes("component: () => import('@/views/Family.vue')"), '/family precisa abrir tela simples de Familia.')
assert.ok(router.includes("path: '/settings/family'") && router.includes("redirect: '/family'"), '/settings/family precisa redirecionar para /family.')
assert.ok(router.includes("path: '/family-hub'"), 'Hub familiar legado precisa ficar fora da rota principal.')

for (const label of ['Nome', 'Participa das', 'Observa']) {
  assert.ok(family.includes(label), `Tela de Familia sem campo obrigatorio: ${label}`)
}
for (const relation of ['Filho(a)', 'Outro familiar', 'Outro']) {
  assert.ok(domain.includes(relation), `Relacao familiar ausente: ${relation}`)
}
assert.ok(domain.includes("from('user_family_members')"), 'Familia precisa persistir em user_family_members.')
assert.ok(domain.includes(".eq('user_id', user.id)"), 'Familia precisa filtrar registros pelo usuario atual.')
assert.ok(domain.includes(".is('deleted_at', null)"), 'Familia precisa ignorar removidos logicamente.')
assert.equal(/localStorage|finance_states/.test(`${family}\n${domain}`), false, 'Familia 11.2 nao pode depender de localStorage/finance_states.')

assert.ok(migration.includes('create table if not exists public.user_family_members'), 'Migration precisa criar user_family_members.')
assert.ok(migration.includes('alter table public.user_family_members enable row level security'), 'Migration precisa habilitar RLS.')
assert.ok(migration.includes('(select auth.uid()) = user_id'), 'Policies precisam isolar pelo usuario autenticado.')

console.log('Family menu validation: PASS')
