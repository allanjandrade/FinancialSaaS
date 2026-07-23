<template>
  <PageShell
    title="Configurações"
    description="Gerencie sua conta, preferências, privacidade e assinatura."
    testid="settings-page"
  >
    <div class="settings-shell">
      <nav class="settings-nav" aria-label="Seções de configurações" data-testid="settings-nav">
        <button
          v-for="section in sections"
          :key="section.id"
          type="button"
          :class="{ active: activeTab === section.id }"
          @click="selectSettingsTab(section.id)"
        >
          {{ section.label }}
        </button>
      </nav>

      <section class="settings-content">
        <article v-if="activeTab === 'account'" class="settings-card" data-testid="settings-account">
          <h2>Conta</h2>
          <p>Gerencie suas informações básicas e a forma como seu perfil aparece no aplicativo.</p>
          <AvatarUploader @updated="applyProfileFromStore" />
          <form class="stacked-form" @submit.prevent="saveProfile">
            <label>Nome de exibição<input v-model="profile.name" type="text" /></label>
            <label>E-mail<input v-model="profile.email" type="email" disabled /></label>
            <label>Status da conta<input value="Ativa" disabled /></label>
            <label>Tipo de acesso<input :value="accessLabel" disabled /></label>
            <button type="submit" class="primary-button">Salvar alterações</button>
          </form>
        </article>

        <article v-else-if="activeTab === 'security'" class="settings-card">
          <h2>Segurança</h2>
          <p>Proteja o acesso à sua conta e mantenha suas informações seguras.</p>
          <div class="action-list">
            <div><strong>E-mail de acesso</strong><span>Atualize o e-mail usado para entrar na sua conta.</span><button class="secondary-button" @click="showEmailModal = true">Alterar e-mail</button></div>
            <div><strong>Senha</strong><span>Altere sua senha periodicamente para manter sua conta protegida.</span><button class="secondary-button" @click="showPasswordModal = true">Alterar senha</button></div>
            <div><strong>Login com Google</strong><span>Use sua conta Google para entrar com mais praticidade e segurança.</span><button class="secondary-button">Conectar Google</button></div>
          </div>
        </article>

        <article v-else-if="activeTab === 'integrations'" class="settings-card" data-testid="settings-integrations">
          <h2>Integrações</h2>
          <p>Conecte serviços externos, revise importações e acompanhe quais recursos podem trocar dados com sua conta.</p>
          <div class="action-list">
            <div><strong>Integrações financeiras</strong><span>Centralize contas, cartões, benefícios e futuras conexões bancárias em um só lugar.</span><router-link to="/structure?tab=integrations">Abrir integrações financeiras</router-link></div>
            <div><strong>Importação de lançamentos</strong><span>Use CSV ou cadastro manual para trazer movimentações sem depender de sincronização automática.</span><router-link to="/entries">Importar lançamentos</router-link></div>
            <div><strong>Login e serviços conectados</strong><span>Revise provedores de acesso e permissões relacionadas à segurança da sua conta.</span><button class="secondary-button" @click="selectSettingsTab('security')">Ver segurança</button></div>
          </div>
        </article>

        <article v-else-if="activeTab === 'preferences'" class="settings-card">
          <h2>Preferências</h2>
          <p>Ajuste a aparência e o comportamento do aplicativo do seu jeito.</p>
          <form class="stacked-form" @submit.prevent="saveAppearance">
            <fieldset>
              <legend>Tema</legend>
              <label><input v-model="appearanceSettings.theme" type="radio" value="light" /> Claro</label>
              <label><input v-model="appearanceSettings.theme" type="radio" value="dark" /> Escuro</label>
              <label><input v-model="appearanceSettings.theme" type="radio" value="auto" /> Automático</label>
            </fieldset>
            <fieldset>
              <legend>Tela inicial</legend>
              <label><input v-model="appearanceSettings.homeLayout" type="radio" value="default" /> Padrão</label>
              <label><input v-model="appearanceSettings.homeLayout" type="radio" value="compact" /> Compacto</label>
              <label><input v-model="appearanceSettings.homeLayout" type="radio" value="detailed" /> Detalhado</label>
            </fieldset>
            <label class="inline-check"><input v-model="appearanceSettings.hideBalance" type="checkbox" /> Ocultar valores na tela inicial</label>
            <button class="primary-button" type="submit">Salvar preferências</button>
          </form>
        </article>

        <article v-else-if="activeTab === 'privacy'" class="settings-card" data-testid="settings-privacy">
          <h2>Privacidade e dados</h2>
          <p>Veja como seus dados são usados e controle suas preferências de privacidade.</p>
          <div class="action-list">
            <div><strong>Uso dos dados</strong><span>Suas informações são usadas para organizar seu painel, gerar análises e manter sua conta segura.</span><router-link to="/data-processing">Ver detalhes de privacidade</router-link></div>
            <div><strong>Exportar diagnóstico</strong><span>Gere um arquivo com informações técnicas básicas para ajudar no suporte, sem expor seus dados financeiros completos.</span><button class="secondary-button">Exportar diagnóstico</button></div>
            <div><strong>Excluir conta e dados</strong><span>Você pode solicitar a exclusão dos seus dados quando desejar.</span><router-link to="/lgpd-requests">Solicitar exclusão</router-link></div>
          </div>
        </article>

        <article v-else-if="activeTab === 'copilot'" class="settings-card" data-testid="ai-settings">
          <h2>Copiloto financeiro</h2>
          <p>Controle como o assistente pode ajudar você dentro do aplicativo.</p>
          <div class="consent-card">
            <div>
              <strong>{{ aiEnabled ? 'Assistente ativado' : 'Assistente desativado' }}</strong>
              <span>O copiloto ajuda a interpretar seus dados financeiros, sugerir próximos passos e explicar riscos. Ele não altera nada sozinho.</span>
              <small>Qualquer ação que envolva mudança nos seus dados precisa da sua confirmação. Você pode desativar o copiloto a qualquer momento.</small>
            </div>
            <label class="inline-check">
              <input v-model="aiEnabled" data-testid="ai-consent-toggle" type="checkbox" :disabled="aiSaving || aiLoading" @change="saveAiConsent" />
              {{ aiEnabled ? 'Desativar copiloto' : 'Ativar copiloto' }}
            </label>
          </div>
          <p v-if="aiError" class="error-message">{{ aiError }}</p>
          <div class="history-block">
            <div class="history-head"><div><h3>Histórico de ações confirmadas</h3><p>Veja ações que você confirmou ou reverteu com apoio do copiloto.</p></div><button type="button" class="secondary-button" @click="loadAiHistory">Atualizar histórico</button></div>
            <p v-if="aiHistoryLoading">Carregando histórico...</p>
            <p v-else-if="!aiHistory.length">Nenhuma ação confirmada.</p>
            <ul v-else>
              <li v-for="item in aiHistory" :key="item.id">
                <span>{{ actionLabel(item.action_type) }}</span>
                <strong>{{ item.reverted_at ? 'Revertido' : 'Confirmado' }}</strong>
                <button v-if="!item.reverted_at" type="button" class="secondary-button" :disabled="aiReverting === item.id" @click="revertHistoryItem(item)">Reverter</button>
              </li>
            </ul>
          </div>
        </article>

        <article v-else-if="activeTab === 'billing'" class="settings-card">
          <h2>Assinatura</h2>
          <p>Veja seu plano atual, limites de uso e opções disponíveis.</p>
          <strong>{{ accessLabel }}</strong>
          <p>{{ billingCopy }}</p>
          <router-link to="/pricing" class="secondary-button">Ver planos</router-link>
        </article>

        <article v-else-if="activeTab === 'support'" class="settings-card">
          <h2>Suporte</h2>
          <p>Precisa de ajuda? Encontre informações úteis na Central de Suporte.</p>
          <div class="action-list">
            <div><strong>Central de ajuda</strong><span>Veja respostas para dúvidas comuns.</span><router-link to="/support">Abrir suporte</router-link></div>
            <div><strong>Reportar problema</strong><span>Canal de atendimento será informado no lançamento oficial.</span></div>
            <div><strong>Privacidade e termos</strong><span>Acesse nossas informações legais e de privacidade.</span><router-link to="/privacy">Abrir privacidade</router-link></div>
          </div>
        </article>

        <article v-else class="settings-card">
          <h2>Sobre o aplicativo</h2>
          <p>Uma plataforma para organizar sua vida financeira, acompanhar metas, planejar compras e tomar decisões com mais clareza.</p>
          <ul class="about-list">
            <li data-testid="settings-app-version"><strong>Versão</strong><span>{{ APP_VERSION }}</span></li>
            <li><strong>Canal</strong><span>{{ APP_RELEASE_CHANNEL }}</span></li>
            <li><strong>Atualização</strong><span>{{ APP_RELEASE_DATE }}</span></li>
            <li><router-link to="/privacy">Política de privacidade</router-link></li>
            <li><router-link to="/terms">Termos de uso</router-link></li>
            <li><router-link to="/security">Status do sistema</router-link></li>
          </ul>
        </article>
      </section>
    </div>

    <div v-if="showEmailModal" class="modal-overlay" @click="showEmailModal = false">
      <form class="modal-content" @click.stop @submit.prevent="changeEmail">
        <h3>Alterar e-mail</h3>
        <label>E-mail atual<input v-model="emailForm.currentEmail" type="email" disabled /></label>
        <label>Novo e-mail<input v-model="emailForm.newEmail" type="email" required /></label>
        <label>Confirmar novo e-mail<input v-model="emailForm.confirmEmail" type="email" required /></label>
        <div class="modal-actions"><button type="button" class="secondary-button" @click="showEmailModal = false">Cancelar</button><button class="primary-button">Alterar e-mail</button></div>
      </form>
    </div>

    <div v-if="showPasswordModal" class="modal-overlay" @click="showPasswordModal = false">
      <form class="modal-content" @click.stop @submit.prevent="changePassword">
        <h3>Alterar senha</h3>
        <label>Senha atual<input v-model="passwordForm.currentPassword" type="password" required /></label>
        <label>Nova senha<input v-model="passwordForm.newPassword" type="password" required minlength="6" /></label>
        <label>Confirmar nova senha<input v-model="passwordForm.confirmPassword" type="password" required minlength="6" /></label>
        <div class="modal-actions"><button type="button" class="secondary-button" @click="showPasswordModal = false">Cancelar</button><button class="primary-button">Alterar senha</button></div>
      </form>
    </div>
  </PageShell>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import PageShell from '@/components/layout/PageShell.vue'
import AvatarUploader from '@/components/profile/AvatarUploader.vue'
import { useFinanceStore } from '@/stores/finance'
import { useAuthStore } from '@/stores/auth'
import { useProfileStore } from '@/stores/profileStore.js'
import { useTheme } from '@/composables/useTheme'
import { useNotification } from '@/composables/useNotification'
import { getAiConsent, setAiConsent } from '@/api/ai-assist.js'
import { listAiActionHistory, revertAiAction } from '@/api/ai-actions.js'
import { APP_RELEASE_CHANNEL, APP_RELEASE_DATE, APP_VERSION } from '@/config/app-version.js'
import { getSupabaseClient } from '@/lib/supabase-client.js'
import { currentPlanLabel } from '@/domain/billing/plans.js'
import { loadAuthenticatedContext } from '@/lib/authenticated-context.js'
import {
  loadUserProfile,
  removeProfileAvatar,
  updateUserProfile,
  uploadProfileAvatar,
  validateAvatarFile,
} from '@/domain/profile/updateUserProfile.js'

const sections = [
  { id: 'account', label: 'Conta' },
  { id: 'security', label: 'Segurança' },
  { id: 'integrations', label: 'Integrações' },
  { id: 'preferences', label: 'Preferências' },
  { id: 'privacy', label: 'Privacidade e dados' },
  { id: 'copilot', label: 'Copiloto financeiro' },
  { id: 'billing', label: 'Assinatura' },
  { id: 'support', label: 'Suporte' },
  { id: 'about', label: 'Sobre' },
]

const financeStore = useFinanceStore()
const authStore = useAuthStore()
const profileStore = useProfileStore()
const { setTheme } = useTheme()
const { showToast } = useNotification()
const route = useRoute()
const router = useRouter()
const activeTab = ref('account')
const avatarInput = ref(null)
const avatarPreview = ref('')
const avatarError = ref('')
const avatarMessage = ref('')
const avatarPath = ref('')
const avatarMaxBytes = 2 * 1024 * 1024
const avatarSizeCopy = 'A imagem deve ter até 2 MB.'
const remoteEntitlements = ref(null)
const aiEnabled = ref(false)
const aiLoading = ref(false)
const aiSaving = ref(false)
const aiError = ref('')
const aiHistory = ref([])
const aiHistoryLoading = ref(false)
const aiReverting = ref('')
const showEmailModal = ref(false)
const showPasswordModal = ref(false)

const profile = ref({ name: '', email: '' })
const emailForm = ref({ currentEmail: '', newEmail: '', confirmEmail: '' })
const passwordForm = ref({ currentPassword: '', newPassword: '', confirmPassword: '' })
const appearanceSettings = ref({ hideBalance: false, theme: 'auto', homeLayout: 'default' })

const SETTINGS_TAB_ALIASES = {
  account: 'account',
  profile: 'account',
  perfil: 'account',
  security: 'security',
  seguranca: 'security',
  segurança: 'security',
  integrations: 'integrations',
  integration: 'integrations',
  integracoes: 'integrations',
  integrações: 'integrations',
  preferences: 'preferences',
  preferencias: 'preferences',
  preferências: 'preferences',
  privacy: 'privacy',
  privacidade: 'privacy',
  ai: 'copilot',
  copilot: 'copilot',
  billing: 'billing',
  assinatura: 'billing',
  support: 'support',
  suporte: 'support',
  about: 'about',
  sobre: 'about',
}

function tabFromRoute(tab) {
  const raw = Array.isArray(tab) ? tab[0] : tab
  return SETTINGS_TAB_ALIASES[String(raw || 'account').toLowerCase()] || 'account'
}

watch(
  () => route.query.tab,
  (tab) => {
    activeTab.value = tabFromRoute(tab)
  },
  { immediate: true }
)

function selectSettingsTab(tab) {
  const nextTab = tabFromRoute(tab)
  activeTab.value = nextTab
  const query = { ...route.query }
  if (nextTab === 'account') {
    delete query.tab
  } else {
    query.tab = nextTab
  }
  if ((route.query.tab || '') === (query.tab || '')) return
  router.replace({ path: '/settings', query }).catch(() => {})
}

const accessLabel = computed(() => currentPlanLabel(entitlementPlanCode.value))
const billingCopy = computed(() => accessLabel.value.includes('Premium')
  ? 'Sua assinatura Premium está ativa com análises, simulações e limites ampliados.'
  : 'Você está usando o plano gratuito para controlar receitas, despesas, contas e cartões de forma simples.'
)

const entitlementPlanCode = computed(() => remoteEntitlements.value?.plan_code || localPlanCode())

function localPlanCode() {
  try {
    const stored = JSON.parse(localStorage.getItem('release10-subscription') || '{}')
    return stored.status === 'active' ? stored.plan_code || 'free' : 'free'
  } catch {
    return 'free'
  }
}

async function saveProfile() {
  try {
    const supabase = getSupabaseClient()
    const saved = await profileStore.saveProfile(supabase, authStore.user, {
      display_name: profile.value.name,
      avatar_url: profileStore.profile.avatar_url || null,
      avatar_path: profileStore.profile.avatar_path || null,
      preferred_theme: appearanceSettings.value.theme,
      preferred_home_view: appearanceSettings.value.homeLayout,
      hide_sensitive_values: appearanceSettings.value.hideBalance,
    })
    avatarPath.value = saved?.avatar_path || ''
    showToast('Perfil salvo com sucesso.', 'success')
  } catch (error) {
    showToast(error?.message || 'Não foi possível salvar o perfil.', 'error')
  }
}

function applyProfileFromStore() {
  profile.value.name = profileStore.displayName || profile.value.name
  avatarPreview.value = profileStore.avatarUrl
  avatarPath.value = profileStore.profile.avatar_path || ''
}

function changeEmail() {
  if (emailForm.value.newEmail !== emailForm.value.confirmEmail) {
    showToast('Os e-mails não coincidem.', 'error')
    return
  }
  showToast('E-mail alterado com sucesso. Verifique sua caixa de entrada para confirmar.', 'success')
  showEmailModal.value = false
}

function changePassword() {
  if (passwordForm.value.newPassword !== passwordForm.value.confirmPassword) {
    showToast('As senhas não coincidem.', 'error')
    return
  }
  showToast('Senha alterada com sucesso.', 'success')
  showPasswordModal.value = false
}

function saveAppearance() {
  financeStore.updateSettings(appearanceSettings.value)
  setTheme(appearanceSettings.value.theme)
  showToast('Preferências salvas com sucesso.', 'success')
}

async function handleAvatarFile(event) {
  avatarError.value = ''
  avatarMessage.value = ''
  const file = event.target.files?.[0]
  if (!file) return
  avatarPreview.value = URL.createObjectURL(file)
  try {
    if (file.size > avatarMaxBytes) throw new Error(avatarSizeCopy)
    validateAvatarFile(file)
    const supabase = getSupabaseClient()
    const saved = await uploadProfileAvatar(supabase, authStore.user, file, {
      display_name: profile.value.name,
      avatar_path: avatarPath.value,
      preferred_theme: appearanceSettings.value.theme,
      preferred_home_view: appearanceSettings.value.homeLayout,
      hide_sensitive_values: appearanceSettings.value.hideBalance,
    })
    avatarPreview.value = saved?.avatar_url || avatarPreview.value
    avatarPath.value = saved?.avatar_path || ''
    avatarMessage.value = 'Foto atualizada com sucesso.'
  } catch (error) {
    avatarError.value = error?.message || 'Não foi possível atualizar a foto. Tente novamente.'
  }
}

async function removeAvatar() {
  avatarError.value = ''
  avatarMessage.value = ''
  try {
    const supabase = getSupabaseClient()
    await removeProfileAvatar(supabase, authStore.user, {
      display_name: profile.value.name,
      avatar_path: avatarPath.value,
      preferred_theme: appearanceSettings.value.theme,
      preferred_home_view: appearanceSettings.value.homeLayout,
      hide_sensitive_values: appearanceSettings.value.hideBalance,
    })
    avatarPreview.value = ''
    avatarPath.value = ''
    avatarMessage.value = 'Foto removida.'
  } catch (error) {
    avatarError.value = error?.message || 'Não foi possível atualizar a foto. Tente novamente.'
  }
}

async function loadAiConsent() {
  aiLoading.value = true
  aiError.value = ''
  try {
    const setting = await getAiConsent()
    aiEnabled.value = Boolean(setting.enabled && setting.consented_at && !setting.revoked_at)
  } catch (error) {
    aiError.value = error?.message || 'Não foi possível consultar o consentimento.'
  } finally {
    aiLoading.value = false
  }
}

const actionLabels = {
  add_to_wishlist: 'Item adicionado à lista',
  create_alert: 'Alerta criado',
  create_recurring_rule: 'Regra recorrente criada',
  create_transaction: 'Lançamento criado',
  update_transaction_category: 'Categoria alterada',
  mark_as_internal_transfer: 'Transferência interna marcada',
}
const actionLabel = (type) => actionLabels[type] || 'Ação confirmada'
async function loadAiHistory() {
  aiHistoryLoading.value = true
  try { aiHistory.value = await listAiActionHistory() } catch { aiError.value = 'Não foi possível carregar o histórico.' } finally { aiHistoryLoading.value = false }
}
async function revertHistoryItem(item) {
  aiReverting.value = item.id
  try { await revertAiAction(item.id); await loadAiHistory(); showToast('Ação revertida com segurança.', 'success') } catch (error) { showToast(error?.message || 'Não foi possível reverter.', 'error') } finally { aiReverting.value = '' }
}
async function saveAiConsent() {
  aiSaving.value = true
  aiError.value = ''
  try {
    await setAiConsent(aiEnabled.value)
    showToast(aiEnabled.value ? 'Copiloto ativado.' : 'Copiloto desativado.', 'success')
  } catch {
    aiEnabled.value = !aiEnabled.value
    aiError.value = 'Não foi possível salvar o consentimento.'
  } finally {
    aiSaving.value = false
  }
}

async function loadProfile() {
  try {
    const supabase = getSupabaseClient()
    const loaded = await profileStore.loadProfile(supabase, authStore.user)
    if (!loaded) return
    profile.value.name = loaded.display_name || profile.value.name
    avatarPreview.value = loaded.avatar_url || avatarPreview.value
    avatarPath.value = loaded.avatar_path || ''
    appearanceSettings.value = {
      hideBalance: Boolean(loaded.hide_sensitive_values ?? financeStore.state.settings.hideBalance),
      theme: loaded.preferred_theme || localStorage.getItem('theme') || 'auto',
      homeLayout: loaded.preferred_home_view || financeStore.state.settings.homeLayout || 'default',
    }
  } catch {
    // Perfil remoto indisponível não bloqueia a tela de configurações.
  }
}

async function loadEntitlements() {
  try {
    const context = await loadAuthenticatedContext()
    if (context?.entitlements) remoteEntitlements.value = context.entitlements
  } catch {
    remoteEntitlements.value = null
  }
}

onMounted(() => {
  const user = authStore.user
  profile.value.email = user?.email || ''
  profile.value.name = user?.user_metadata?.name || user?.email?.split('@')[0] || ''
  avatarPreview.value = user?.user_metadata?.avatar_url || ''
  avatarPath.value = user?.user_metadata?.avatar_path || ''
  profileStore.hydrateFromUser(user)
  emailForm.value.currentEmail = profile.value.email
  appearanceSettings.value = {
    hideBalance: financeStore.state.settings.hideBalance,
    theme: localStorage.getItem('theme') || 'auto',
    homeLayout: financeStore.state.settings.homeLayout || 'default',
  }
  loadAiConsent()
  loadAiHistory()
  loadProfile()
  loadEntitlements()
})
</script>

<style scoped>
.settings-shell {
  display: grid;
  grid-template-columns: 240px minmax(0, 1fr);
  gap: 1rem;
}

.settings-nav, .settings-card {
  border: 1px solid var(--border-color);
  border-radius: 14px;
  background: var(--bg-panel);
}

.settings-nav {
  display: grid;
  align-content: start;
  gap: .35rem;
  padding: .75rem;
}

.settings-nav button {
  border: 0;
  border-radius: var(--radius-sm);
  padding: .8rem .9rem;
  background: transparent;
  color: var(--text-secondary);
  font-weight: 800;
  text-align: left;
  cursor: pointer;
}

.settings-nav button.active {
  background: var(--blue-dim);
  color: var(--text-primary);
}

.settings-content, .settings-card, .stacked-form, .action-list {
  display: grid;
  gap: 1rem;
}

.settings-card {
  padding: 1rem;
}

h2, h3, p { margin: 0; }
.settings-card > p, .action-list span, small { color: var(--text-secondary); line-height: 1.6; }

.avatar-row {
  display: flex;
  align-items: center;
  gap: 1rem;
  flex-wrap: wrap;
}

.avatar-preview {
  width: 96px;
  height: 96px;
  display: grid;
  place-items: center;
  border-radius: 50%;
  overflow: hidden;
  background: var(--bg-elevated);
  border: 1px solid var(--border-color);
}

.avatar-preview img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.avatar-actions, .action-list > div, .consent-card, .history-head {
  display: grid;
  gap: .55rem;
}

.action-list > div, .consent-card {
  padding: 1rem;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  background: var(--bg-elevated);
}

label { display: grid; gap: .45rem; color: var(--text-primary); font-weight: 800; }
input {
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  padding: .75rem .85rem;
  background: var(--bg-input);
  color: var(--text-primary);
}

fieldset {
  display: flex;
  gap: .8rem;
  flex-wrap: wrap;
  border: 1px solid var(--border-color);
  border-radius: 12px;
  padding: 1rem;
}

legend { color: var(--text-secondary); font-weight: 900; }
.inline-check { display: flex; align-items: center; gap: .55rem; }
.inline-check input { width: 18px; height: 18px; }

.primary-button, .secondary-button, .ghost-button, .action-list a, .about-list a {
  width: fit-content;
  border-radius: 10px;
  padding: .72rem .95rem;
  font-weight: 900;
  text-decoration: none;
}

.primary-button { border: 0; background: var(--accent); color: white; }
.secondary-button, .action-list a, .about-list a { border: 1px solid var(--border-color); background: var(--bg-input); color: var(--text-primary); }
.ghost-button { border: 0; background: transparent; color: var(--text-secondary); }

.status-message { color: var(--income); font-weight: 800; }
.error-message { color: #f87171; font-weight: 800; }
.sr-only { position: absolute; width: 1px; height: 1px; padding: 0; overflow: hidden; clip: rect(0,0,0,0); white-space: nowrap; border: 0; }

.history-block ul, .about-list {
  display: grid;
  gap: .6rem;
  padding: 0;
  list-style: none;
}

.history-block li, .about-list li {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: .75rem;
  flex-wrap: wrap;
  padding: .75rem;
  border: 1px solid var(--border-color);
  border-radius: 10px;
}

.modal-overlay {
  position: fixed;
  inset: 0;
  z-index: 50;
  display: grid;
  place-items: center;
  padding: 1rem;
  background: rgba(0,0,0,.55);
}

.modal-content {
  width: min(520px, 100%);
  display: grid;
  gap: 1rem;
  padding: 1.25rem;
  border: 1px solid var(--border-color);
  border-radius: 14px;
  background: var(--bg-panel);
}

.modal-actions { display: flex; justify-content: flex-end; gap: .75rem; flex-wrap: wrap; }

@media (max-width: 820px) {
  .settings-shell { grid-template-columns: 1fr; }
  .settings-nav { display: flex; overflow-x: auto; }
  .settings-nav button { white-space: nowrap; }
}
</style>
