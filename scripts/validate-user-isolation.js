import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()

function read(file) {
  return fs.readFileSync(path.join(root, file), 'utf8')
}

function listFiles(dir, extensions, files = []) {
  for (const entry of fs.readdirSync(path.join(root, dir), { withFileTypes: true })) {
    if (['node_modules', 'dist', '.git', '.cypress-cache', 'tmp'].includes(entry.name)) continue
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) listFiles(full, extensions, files)
    else if (extensions.includes(path.extname(entry.name))) files.push(full)
  }
  return files
}

const sourceFiles = [
  ...listFiles('src', ['.js', '.vue']),
  ...listFiles('supabase/functions', ['.ts', '.js']),
]

const allowedGlobalStorageFiles = new Set([
  'src/lib/userScopedStorage.js',
])

for (const file of sourceFiles) {
  const source = read(file)
  if (!allowedGlobalStorageFiles.has(file)) {
    assert.equal(
      /localStorage\.(?:getItem|setItem)\(\s*['"]controle-financeiro-app-v2['"]/.test(source),
      false,
      `${file} acessa cache financeiro global sem escopo de usuario.`,
    )
    assert.equal(
      /localStorage\.setItem\(\s*['"](?:wishlist|purchases)['"]/.test(source),
      false,
      `${file} grava wishlist/compras em cache global.`,
    )
  }

  if (file.startsWith('supabase/functions/') && !file.includes('/admin-')) {
    assert.equal(
      /const\s+userId\s*=\s*body\.user_id/.test(source),
      false,
      `${file} usa body.user_id como fonte de identidade.`,
    )
  }

  if (/from\(['"]finance_states['"]\)/.test(source) || /finance_states\?select=/.test(source)) {
    assert.match(
      source,
      /user_id|loadAuthorizedFinanceState|checkTable\('finance_states\?select=family_id&limit=1'\)/,
      `${file} acessa finance_states sem indicio de escopo por user_id.`,
    )
  }

  assert.equal(/createWishlistItem\s*\(\s*\{\s*user_id/.test(source), false, `${file} cria wishlist com user_id manual.`)
  assert.equal(/newPurchase\s*\(\s*\{\s*user_id/.test(source), false, `${file} cria nova compra com user_id manual.`)
}

const financeStore = read('src/stores/finance.js')
assert.match(financeStore, /activeUserId/, 'Finance store precisa controlar usuario ativo.')
assert.match(financeStore, /setActiveUser/, 'Finance store precisa trocar escopo ao trocar sessao.')
assert.match(financeStore, /migrateLegacyStorageToUserScope/, 'Cache legado precisa migrar apenas para usuario autenticado.')

const authStore = read('src/stores/auth.js')
assert.match(authStore, /useFinanceStore\(\)\.setActiveUser\(nextUserId\)/, 'Auth listener precisa trocar o escopo financeiro por user_id.')
assert.match(authStore, /useFamilySyncStore\(\)\.teardown\(\)/, 'Troca de sessao precisa desmontar sync/realtime anterior.')

const workflow = read('src/composables/usePurchaseWorkflow.js')
assert.match(workflow, /auth\.getUser/, 'Nova compra precisa validar usuario autenticado.')
assert.match(workflow, /FORBIDDEN_WISHLIST_FIELDS/, 'Nova compra precisa rejeitar identidade manual.')
assert.equal(/user_id\s*:/.test(workflow), false, 'Nova compra nao deve montar payload com user_id.')

const financeState = read('supabase/functions/_shared/finance-state.ts')
assert.match(financeState, /user_id=eq\.\$\{encodeURIComponent\(userId\)\}/, 'Edge Functions precisam carregar finance_states por user_id.')

const migration = read('supabase/migrations/20260621110000_hotfix_p0_user_isolation.sql')
assert.match(migration, /alter table public\.finance_states\s+add column if not exists user_id/i, 'Migration precisa adicionar user_id em finance_states.')
assert.match(migration, /alter table public\.finance_states force row level security/i, 'finance_states precisa FORCE RLS.')
assert.match(migration, /using \(\(select auth\.uid\(\)\) = user_id\)/i, 'finance_states precisa policy select own por auth.uid.')
assert.match(migration, /with check \(\(select auth\.uid\(\)\) = user_id\)/i, 'finance_states precisa policy write own por auth.uid.')
assert.match(migration, /where family_id = v_draft\.family_id\s+and user_id = p_user_id/i, 'commit_ai_action precisa filtrar finance_states por user_id.')
assert.match(migration, /where family_id = v_log\.family_id\s+and user_id = p_user_id/i, 'revert_ai_action precisa filtrar finance_states por user_id.')
assert.match(migration, /p_user_id uuid,\s+p_item_id text/s, 'Monitoramento de wishlist precisa receber user_id.')

console.log('User isolation validation: PASS')
