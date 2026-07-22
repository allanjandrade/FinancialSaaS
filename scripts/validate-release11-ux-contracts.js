import fs from 'node:fs'
import assert from 'node:assert/strict'
import { NAV_GROUPS, ROUTE_META } from '../src/router/navigation.js'
import { SUPPORT_FAQ } from '../src/domain/support/staticFaq.js'
import { answerSupportQuestion } from '../src/domain/support/supportAgent.js'
import { currentPlanLabel } from '../src/domain/billing/plans.js'

const read = (file) => fs.readFileSync(file, 'utf8')

const router = read('src/router/index.js')
const purchaseNew = read('src/views/PurchaseNew.vue')
const aiHub = read('src/views/AIActionHub.vue')
const ai = read('src/views/AI.vue')
const automations = read('src/views/Automations.vue')
const settings = read('src/views/Settings.vue')
const support = read('src/views/Support.vue')
const css = read('src/styles/main.css')
const confirmModal = read('src/components/ConfirmModal.vue')
const toast = read('src/components/ui/AppToast.vue')
const profileDomain = read('src/domain/profile/updateUserProfile.js')
const migration = read('supabase/migrations/20260621130000_release11_profile_support_ux.sql')

assert.ok(router.includes("component: () => import('@/views/AIActionHub.vue')"), '/ai-actions deve abrir o hub de inteligência')
assert.equal(/path:\s*'\/ai-actions'[\s\S]{0,140}PurchaseNew\.vue/.test(router), false, '/ai-actions não pode reutilizar Nova compra')
assert.ok(router.includes("path: '/support'"), 'Rota /support precisa existir')

const menuPaths = NAV_GROUPS.flatMap((group) => group.items.map((item) => item.path))
const routePaths = Object.keys(ROUTE_META)
assert.ok(menuPaths.includes('/advisor'), 'Menu de inteligencia precisa expor Consultor')
assert.equal(menuPaths.includes('/ai'), false, 'Copiloto deve ser rota contextual, nao item principal')
assert.equal(menuPaths.includes('/ai-actions'), false, 'Acoes inteligentes devem ser rota contextual, nao item principal')
assert.equal(menuPaths.includes('/automations'), false, 'Alertas devem ser rota contextual, nao item principal')
assert.equal(menuPaths.includes('/simulations'), false, 'Simulacoes ficam dentro de Planejamento, nao no menu principal')
assert.equal(menuPaths.includes('/support'), false, 'Suporte deve continuar como rota acessivel sem disputar o menu principal')
for (const path of ['/ai', '/ai-actions', '/automations', '/advisor', '/simulations', '/support']) {
  assert.ok(routePaths.includes(path), `Rota sem metadata: ${path}`)
}

for (const copy of ['Nova compra', 'Descreva o produto', 'Preço desejado', 'Salvar sem buscar', 'Procurar produto']) {
  assert.ok(purchaseNew.includes(copy), `Nova compra sem contrato: ${copy}`)
}
assert.equal(purchaseNew.includes('Inteligência financeira'), false, 'Nova compra não pode parecer hub de inteligência')

for (const copy of ['Inteligência financeira', 'Consultar meu mês', 'Simular uma compra', 'Encontrar risco no orçamento', 'Revisar gastos por categoria', 'Criar alerta inteligente', 'Explicar meu relatório', 'Buscar produto por descrição', 'Ver ações confirmadas']) {
  assert.ok(aiHub.includes(copy), `Hub de inteligência sem ação: ${copy}`)
}

assert.ok(ai.includes('chat-suggestion-cards'), 'Chat precisa de sugestões iniciais')
assert.ok(ai.includes('width: min(800px, 100%)'), 'Chat precisa de largura controlada')

assert.ok(automations.includes('Criar alerta automático'), 'Alertas precisam usar linguagem de alerta')
assert.equal(automations.includes('window.confirm'), false, 'Exclusão de alerta não pode usar window.confirm')

assert.ok(confirmModal.includes('ref="cancelButton"'), 'Modal destrutivo precisa focar Cancelar')
assert.ok(confirmModal.includes('@keydown.esc'), 'Modal precisa fechar com Escape')
assert.ok(confirmModal.includes('destructive'), 'Modal precisa suportar ação destrutiva')

assert.ok(css.includes('--touch-target-min: 44px'), 'CSS precisa declarar alvo mínimo de toque')
assert.ok(toast.includes('role="alert"'), 'Toast precisa usar role alert')
assert.ok(toast.includes('data-testid="app-toast"'), 'Toast precisa ser testável')

assert.ok(settings.includes('loadUserProfile'), 'Settings precisa carregar perfil remoto')
assert.ok(settings.includes('updateUserProfile'), 'Settings precisa persistir perfil remoto')
assert.ok(profileDomain.includes('MAX_AVATAR_BYTES = 2 * 1024 * 1024'), 'Avatar precisa limitar 2 MB')
assert.ok(migration.includes('create table if not exists public.user_profiles'), 'Migration precisa criar user_profiles')
assert.ok(migration.includes("bucket_id = 'avatars'"), 'Migration precisa criar policies do bucket avatars')

assert.equal(SUPPORT_FAQ.length, 10, 'FAQ precisa ter 10 perguntas')
assert.ok(support.includes('support-fixed-agent'), 'Suporte precisa ter agente fixo de ajuda')
assert.equal(read('src/domain/support/supportAgent.js').includes('finance_states'), false, 'Agente de suporte não pode acessar estado financeiro')
assert.match(answerSupportQuestion('senha').answer, /senha/i)

assert.equal(currentPlanLabel('premium_annual'), 'Plano atual: Premium anual')
assert.equal(currentPlanLabel('premium_monthly'), 'Plano atual: Premium mensal')
assert.equal(currentPlanLabel('free'), 'Plano atual: Grátis')

console.log('Release 11 UX contracts validation: PASS')
