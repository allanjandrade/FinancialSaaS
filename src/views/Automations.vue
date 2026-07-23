<template>
  <div class="automations-view" data-testid="automations-page">
    <section class="panel intro-panel">
      <div class="panel-head">
        <div>
          <h1>Alertas</h1>
          <p>Alertas recorrentes com modelos aprovados, proteção contra repetição e histórico de atividade.</p>
        </div>
        <button type="button" class="secondary-button" data-testid="automation-refresh" :disabled="loading" @click="loadAll">
          <RefreshCw />
          <span>{{ loading ? 'Atualizando' : 'Atualizar' }}</span>
        </button>
      </div>

      <div class="safety-strip">
        <ShieldCheck />
        <div>
          <p>Alertas apenas avisam. Eles não criam lançamentos, não alteram categorias e não movimentam dinheiro.</p>
          <span class="sr-only">Automações apenas avisam</span>
          <small>Você pode pausar ou excluir um alerta a qualquer momento.</small>
        </div>
      </div>

      <div class="maturity-promise" data-testid="automation-maturity-promise">
        <BellRing />
        <div>
          <p>Após 2-3 meses de histórico suficiente, o Consultor preditivo passa a sugerir recomendações personalizadas de automações.</p>
          <small>Enquanto isso, use modelos seguros para alertas básicos e ajuste manualmente conforme sua rotina.</small>
        </div>
      </div>
      <p v-if="error" class="error-message" role="alert">{{ error }}</p>
    </section>

    <section class="panel simple-rules-panel" data-testid="simple-automation-rules">
      <div class="section-title">
        <div>
          <h2>Regras simples</h2>
          <p>Regras locais e determinísticas para acelerar revisão sem executar mudanças financeiras sozinhas.</p>
        </div>
        <span class="status-pill">Sem IA</span>
      </div>

      <div class="simple-rule-controls">
        <label>
          Período de análise
          <select v-model="simpleRules.analysisPeriodDays" data-testid="simple-rule-analysis-period">
            <option :value="7">Últimos 7 dias</option>
            <option :value="15">Últimos 15 dias</option>
            <option :value="30">Últimos 30 dias</option>
            <option value="month">Mês atual</option>
          </select>
        </label>

        <label>
          Limite para alertas de gastos
          <input v-model.number="simpleRules.spendingAlertThreshold" data-testid="simple-rule-spending-threshold" type="number" min="0" step="10" />
        </label>
      </div>

      <div class="simple-rule-grid">
        <article class="simple-rule-card">
          <strong>Categoria automática por palavra-chave</strong>
          <p>Pré-preenche sugestões como “mercado” → Mercado, “uber” → Transporte e “netflix” → Assinaturas.</p>
          <div v-if="categoryKeywordSuggestions.length" class="simple-rule-list">
            <span v-for="suggestion in categoryKeywordSuggestions" :key="suggestion.id">
              {{ suggestion.description }}: {{ suggestion.currentCategory }} → {{ suggestion.category }}
            </span>
          </div>
          <small v-else>Sem lançamentos pendentes de categoria no período. As regras ficam prontas para o próximo cadastro.</small>
        </article>

        <article class="simple-rule-card" :class="{ attention: spendingAlertPreview.triggered }">
          <strong>Alertas de gastos</strong>
          <p>
            {{ formatCurrency(spendingAlertPreview.spent) }} analisados em {{ spendingAlertPreview.periodLabel }}.
            Limite: {{ formatCurrency(spendingAlertPreview.threshold) }}.
          </p>
          <small>
            {{ spendingAlertPreview.triggered ? 'Alerta ativo: gastos acima do limite do período.' : 'Dentro do limite configurado para o período.' }}
          </small>
        </article>
      </div>
    </section>

    <div class="automation-grid">
      <section class="panel create-panel">
        <div class="section-title">
          <h2>Criar alerta automático</h2>
          <span class="status-pill">Apenas wishlist ativa</span>
        </div>

        <form class="automation-form" data-testid="automation-create-form" @submit.prevent="submitAutomation">
          <label>
            Tipo de alerta
            <select v-model="form.templateId" data-testid="automation-template-select" required>
              <option v-for="template in availableTemplates" :key="template.id" :value="template.id">
                {{ template.name }}
              </option>
            </select>
          </label>

          <label>
            Nome do alerta
            <input v-model.trim="form.name" data-testid="automation-name-input" maxlength="120" required />
          </label>

          <div class="form-row">
            <label>
              Frequência
              <select v-model="form.cadence" data-testid="automation-cadence">
                <option value="daily">Diária</option>
                <option value="hourly">Horária</option>
              </select>
            </label>
            <label>
              Cooldown
              <input v-model.number="form.cooldownHours" data-testid="automation-cooldown" type="number" min="1" max="720" />
            </label>
          </div>

          <div class="parameter-box">
            <label v-if="form.templateId === 'cash_balance_below'">
              Limite de saldo
              <input v-model.number="parameters.threshold" data-testid="automation-param-threshold" type="number" min="0" step="10" required />
            </label>

            <label v-else-if="form.templateId === 'card_bill_ratio_above'">
              Percentual da renda
              <input v-model.number="parameters.ratio" data-testid="automation-param-ratio" type="number" min="0.01" max="1" step="0.01" required />
            </label>

            <label v-else-if="form.templateId === 'benefit_depletion_risk'">
              Benefício
              <select v-model="parameters.benefit_type" data-testid="automation-param-benefit">
                <option value="VA">VA</option>
                <option value="VR">VR</option>
              </select>
            </label>

            <label v-else-if="form.templateId === 'bill_due_soon'">
              Dias antes do vencimento
              <input v-model.number="parameters.days_before" data-testid="automation-param-days" type="number" min="1" max="15" required />
            </label>

            <label v-else-if="form.templateId === 'category_anomaly_detected'">
              Severidade mínima
              <select v-model="parameters.severity" data-testid="automation-param-severity">
                <option value="attention">Atenção</option>
                <option value="risk">Risco</option>
                <option value="critical">Crítico</option>
              </select>
            </label>

            <label v-else-if="form.templateId === 'wishlist_target_price_reached'">
              Item da wishlist
              <input v-model.trim="parameters.purchase_item_id" data-testid="automation-param-wishlist" placeholder="ID do item" required />
            </label>
          </div>

          <p class="template-description">{{ selectedTemplate?.description || 'Escolha um modelo aprovado.' }}</p>

          <button type="submit" class="primary-button" data-testid="automation-create" :disabled="saving || !availableTemplates.length">
            <Plus />
            <span>{{ saving ? 'Criando' : 'Criar alerta' }}</span>
          </button>
        </form>
      </section>

      <section class="panel list-panel">
        <div class="section-title">
          <h2>Meus alertas</h2>
          <span class="status-pill">{{ automations.length }}</span>
        </div>

        <p v-if="loading && !automations.length" class="empty-state">Carregando alertas...</p>
        <EmptyState
          v-else-if="!automations.length"
          :icon="BellRing"
          title="Nenhum alerta configurado"
          description="Crie um alerta automático agora. Após 2-3 meses de histórico suficiente, o sistema libera recomendações personalizadas."
          action-label="Criar alerta de wishlist"
          @action="submitAutomation"
        />

        <div v-else class="automation-list">
          <article v-for="automation in automations" :key="automation.id" class="automation-row" data-testid="automation-row">
            <div class="row-main">
              <strong>{{ automation.name }}</strong>
              <small>{{ templateName(automation.template_id) }} · {{ cadenceLabel(automation.cadence) }} · cooldown {{ automation.cooldown_hours }}h</small>
              <small>Próxima verificação: {{ formatDateTime(automation.next_run_at) }}</small>
            </div>
            <div class="row-side">
              <span class="status-pill" :class="automation.status">{{ statusLabel(automation.status) }}</span>
              <div class="row-actions">
                <button
                  v-if="automation.status === 'active'"
                  type="button"
                  class="icon-button"
                  data-testid="automation-pause"
                  title="Pausar"
                  @click="pauseItem(automation)"
                >
                  <Pause />
                </button>
                <button
                  v-else
                  type="button"
                  class="icon-button"
                  data-testid="automation-resume"
                  title="Retomar"
                  @click="resumeItem(automation)"
                >
                  <Play />
                </button>
                <button type="button" class="icon-button danger" data-testid="automation-delete" title="Excluir" @click="deleteItem(automation)">
                  <Trash2 />
                </button>
              </div>
            </div>
            <div v-if="latestRun(automation.id)" class="latest-run">
              Última verificação: {{ statusLabel(latestRun(automation.id).status) }}
              <span v-if="latestRun(automation.id).triggered">· notificação criada</span>
              <span v-else>· sem alerta novo</span>
            </div>
          </article>
        </div>
      </section>
    </div>

    <section class="panel" data-testid="automation-runs">
      <div class="section-title">
        <h2>Histórico de alertas</h2>
        <span class="status-pill">{{ runs.length }}</span>
      </div>
      <p v-if="!runs.length" class="empty-state">Nenhum alerta enviado ainda.</p>
      <div v-else class="run-table">
        <div v-for="run in runs" :key="run.id" class="run-row">
          <span>{{ templateName(run.template_id) }}</span>
          <span>{{ statusLabel(run.status) }}</span>
          <span>{{ run.triggered ? 'Alerta emitido' : 'Sem alerta' }}</span>
          <span>{{ formatDateTime(run.started_at) }}</span>
        </div>
      </div>
    </section>

    <section class="panel" data-testid="automation-notifications">
      <div class="section-title">
        <h2>Notificações in-app</h2>
        <span class="status-pill">{{ unreadCount }} não lidas</span>
      </div>
      <p v-if="!notifications.length" class="empty-state">Nenhuma notificação de alerta.</p>
      <div v-else class="notification-list">
        <article v-for="notification in notifications" :key="notification.id" class="notification-row" :class="{ unread: !notification.read_at }">
          <div>
            <strong>{{ notification.title }}</strong>
            <p>{{ notification.message }}</p>
            <small>{{ formatDateTime(notification.created_at) }} · {{ severityLabel(notification.severity) }}</small>
          </div>
          <button
            v-if="!notification.read_at"
            type="button"
            class="secondary-button"
            data-testid="automation-mark-read"
            @click="markRead(notification)"
          >
            Marcar como lida
          </button>
        </article>
      </div>
    </section>

    <ConfirmModal
      :show="pendingDelete != null"
      title="Excluir alerta?"
      :message="deleteMessage"
      confirm-label="Excluir"
      destructive
      @confirm="confirmDelete"
      @cancel="pendingDelete = null"
    />
  </div>
</template>

<script setup>
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { BellRing, Pause, Play, Plus, RefreshCw, ShieldCheck, Trash2 } from 'lucide-vue-next'
import EmptyState from '@/components/EmptyState.vue'
import ConfirmModal from '@/components/ConfirmModal.vue'
import { useFinanceStore } from '@/stores/finance.js'
import {
  createAutomation,
  deleteAutomation,
  listAutomationNotifications,
  listAutomationTemplates,
  listUserAutomations,
  markAutomationNotificationRead,
  pauseAutomation,
  resumeAutomation,
} from '@/api/automations.js'
import { useNotification } from '@/composables/useNotification'
import {
  buildSpendingAlert,
  findCategoryKeywordSuggestions,
} from '@/utils/simple-automation-rules.js'

const { showToast } = useNotification()
const financeStore = useFinanceStore()
const ACTIVE_AUTOMATION_TEMPLATE_IDS = Object.freeze(['wishlist_target_price_reached'])

const templates = ref([])
const automations = ref([])
const runs = ref([])
const notifications = ref([])
const loading = ref(false)
const saving = ref(false)
const error = ref('')
const pendingDelete = ref(null)

const form = reactive({
  templateId: 'wishlist_target_price_reached',
  name: 'Preço alvo da wishlist',
  cadence: 'daily',
  cooldownHours: 24,
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Sao_Paulo',
})

const parameters = reactive({
  threshold: 500,
  ratio: 0.35,
  benefit_type: 'VA',
  days_before: 3,
  severity: 'attention',
  purchase_item_id: '',
})

const simpleRules = reactive({
  analysisPeriodDays: 30,
  spendingAlertThreshold: 1000,
})

const availableTemplates = computed(() =>
  templates.value.filter((item) => ACTIVE_AUTOMATION_TEMPLATE_IDS.includes(item.id)),
)
const selectedTemplate = computed(() => availableTemplates.value.find((item) => item.id === form.templateId))
const categoryKeywordSuggestions = computed(() =>
  findCategoryKeywordSuggestions(financeStore.state, { limit: 3 }),
)
const spendingAlertPreview = computed(() =>
  buildSpendingAlert(financeStore.state, {
    periodDays: simpleRules.analysisPeriodDays,
    threshold: simpleRules.spendingAlertThreshold,
  }),
)
const unreadCount = computed(() => notifications.value.filter((item) => !item.read_at).length)
const deleteMessage = computed(() => pendingDelete.value
  ? `Excluir "${pendingDelete.value.name}"? Esse alerta será removido e não enviará novos avisos.`
  : '')

watch(
  () => form.templateId,
  () => {
    form.name = selectedTemplate.value?.name || 'Alerta'
    form.cooldownHours = selectedTemplate.value?.default_cooldown_hours || 24
  },
)

function buildParameters() {
  if (form.templateId === 'cash_balance_below') return { threshold: parameters.threshold }
  if (form.templateId === 'card_bill_ratio_above') return { ratio: parameters.ratio }
  if (form.templateId === 'benefit_depletion_risk') return { benefit_type: parameters.benefit_type }
  if (form.templateId === 'bill_due_soon') return { days_before: parameters.days_before }
  if (form.templateId === 'category_anomaly_detected') return { severity: parameters.severity }
  return { purchase_item_id: parameters.purchase_item_id }
}

async function loadAll() {
  loading.value = true
  error.value = ''
  try {
    const [templateResult, automationResult, notificationResult] = await Promise.all([
      listAutomationTemplates(),
      listUserAutomations(50),
      listAutomationNotifications(50),
    ])
    templates.value = templateResult.templates || []
    automations.value = automationResult.automations || []
    runs.value = automationResult.runs || []
    notifications.value = notificationResult.notifications || []
    if (!availableTemplates.value.find((item) => item.id === form.templateId) && availableTemplates.value[0]) {
      form.templateId = availableTemplates.value[0].id
    }
  } catch (err) {
    error.value = err?.message || 'Não foi possível carregar alertas.'
  } finally {
    loading.value = false
  }
}

async function submitAutomation() {
  saving.value = true
  error.value = ''
  try {
    await createAutomation({
      templateId: form.templateId,
      name: form.name,
      parameters: buildParameters(),
      cadence: form.cadence,
      cooldownHours: form.cooldownHours,
      timezone: form.timezone,
    })
    showToast('Alerta criado em modo somente aviso.', 'success')
    await loadAll()
  } catch (err) {
    error.value = err?.message || 'Não foi possível criar o alerta.'
    showToast(error.value, 'error')
  } finally {
    saving.value = false
  }
}

async function pauseItem(automation) {
  await mutateItem(() => pauseAutomation(automation.id), 'Alerta pausado.')
}

async function resumeItem(automation) {
  await mutateItem(() => resumeAutomation(automation.id), 'Alerta retomado.')
}

async function deleteItem(automation) {
  pendingDelete.value = automation
}

async function confirmDelete() {
  const automation = pendingDelete.value
  pendingDelete.value = null
  if (!automation) return
  await mutateItem(() => deleteAutomation(automation.id), 'Alerta excluído.')
}

async function mutateItem(action, message) {
  error.value = ''
  try {
    await action()
    showToast(message, 'success')
    await loadAll()
  } catch (err) {
    error.value = err?.message || 'Não foi possível atualizar o alerta.'
    showToast(error.value, 'error')
  }
}

async function markRead(notification) {
  try {
    await markAutomationNotificationRead(notification.id)
    await loadAll()
  } catch (err) {
    showToast(err?.message || 'Não foi possível marcar como lida.', 'error')
  }
}

function latestRun(automationId) {
  return runs.value.find((run) => run.automation_id === automationId)
}

function templateName(templateId) {
  return templates.value.find((item) => item.id === templateId)?.name || templateId
}

function cadenceLabel(value) {
  return value === 'hourly' ? 'horária' : 'diária'
}

function statusLabel(value) {
  return {
    active: 'ativa',
    paused: 'pausada',
    disabled: 'desativada',
    running: 'rodando',
    success: 'sucesso',
    skipped: 'ignorada',
    failed: 'falhou',
  }[value] || value
}

function severityLabel(value) {
  return {
    info: 'informação',
    attention: 'atenção',
    risk: 'risco',
    critical: 'crítico',
  }[value] || value
}

function formatDateTime(value) {
  if (!value) return 'sem data'
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(value))
}

function formatCurrency(value) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value || 0))
}

onMounted(loadAll)
</script>

<style scoped>
.automations-view {
  display: grid;
  gap: 1rem;
  padding: var(--content-pad);
}

.intro-panel {
  display: grid;
  gap: 1rem;
}

.panel-head h1,
.section-title h2 {
  margin: 0;
}

.panel-head p,
.template-description,
.empty-state,
.notification-row p {
  color: var(--text-secondary);
}

.safety-strip {
  display: flex;
  align-items: flex-start;
  gap: 0.85rem;
  padding: 1rem;
  border: 1px solid rgba(49, 189, 145, 0.28);
  border-radius: 8px;
  background: rgba(49, 189, 145, 0.08);
}

.maturity-promise {
  display: flex;
  align-items: flex-start;
  gap: 0.85rem;
  padding: 1rem;
  border: 1px solid color-mix(in srgb, var(--accent) 26%, var(--border-color));
  border-radius: 8px;
  background: color-mix(in srgb, var(--accent) 8%, var(--bg-panel));
}

.safety-strip svg {
  width: 22px;
  height: 22px;
  color: var(--success);
  flex: 0 0 auto;
}

.maturity-promise svg {
  width: 22px;
  height: 22px;
  color: var(--accent);
  flex: 0 0 auto;
}

.safety-strip p {
  margin: 0 0 0.25rem;
  color: var(--text-primary);
  font-weight: 700;
}

.maturity-promise p {
  margin: 0 0 0.25rem;
  color: var(--text-primary);
  font-weight: 700;
}

.safety-strip small,
.maturity-promise small,
.automation-row small,
.notification-row small {
  color: var(--text-muted);
}

.simple-rules-panel {
  display: grid;
  gap: 1rem;
}

.section-title p {
  margin: 0.25rem 0 0;
  color: var(--text-secondary);
  font-size: 0.85rem;
}

.simple-rule-controls {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.75rem;
}

.simple-rule-controls label {
  display: grid;
  gap: 0.4rem;
  color: var(--text-secondary);
  font-size: 0.85rem;
  font-weight: 700;
}

.simple-rule-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.75rem;
}

.simple-rule-card {
  display: grid;
  align-content: start;
  gap: 0.55rem;
  padding: 0.9rem;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  background: var(--bg-hover);
}

.simple-rule-card.attention {
  border-color: rgba(240, 180, 93, 0.42);
}

.simple-rule-card p {
  margin: 0;
  color: var(--text-secondary);
  font-size: 0.86rem;
}

.simple-rule-card small,
.simple-rule-list {
  color: var(--text-muted);
  font-size: 0.78rem;
}

.simple-rule-list {
  display: grid;
  gap: 0.35rem;
}

.automation-grid {
  display: grid;
  grid-template-columns: minmax(280px, 380px) minmax(0, 1fr);
  gap: 1rem;
  align-items: start;
}

.section-title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 1rem;
}

.automation-form,
.automation-list,
.notification-list {
  display: grid;
  gap: 0.85rem;
}

.automation-form label {
  display: grid;
  gap: 0.4rem;
  color: var(--text-secondary);
  font-size: 0.85rem;
  font-weight: 700;
}

.form-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.75rem;
}

.parameter-box {
  display: grid;
  gap: 0.75rem;
  padding: 0.85rem;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  background: var(--bg-hover);
}

.automation-row,
.notification-row {
  display: grid;
  gap: 0.75rem;
  padding: 0.9rem;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  background: var(--bg-hover);
}

.automation-row {
  grid-template-columns: minmax(0, 1fr) auto;
}

.row-main {
  display: grid;
  gap: 0.2rem;
  min-width: 0;
}

.row-side {
  display: grid;
  justify-items: end;
  gap: 0.65rem;
}

.row-actions {
  display: flex;
  gap: 0.4rem;
}

.icon-button {
  width: 36px;
  height: 36px;
  display: grid;
  place-items: center;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  background: var(--bg-input);
  color: var(--text-secondary);
  cursor: pointer;
}

.icon-button:hover {
  color: var(--accent-hover);
  border-color: var(--border-strong);
}

.icon-button.danger:hover {
  color: var(--danger);
}

.icon-button svg,
.secondary-button svg,
.primary-button svg {
  width: 17px;
  height: 17px;
}

.latest-run {
  grid-column: 1 / -1;
  color: var(--text-secondary);
  font-size: 0.82rem;
}

.run-table {
  display: grid;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  overflow: hidden;
}

.run-row {
  display: grid;
  grid-template-columns: 1.3fr 0.8fr 0.9fr 1fr;
  gap: 0.75rem;
  padding: 0.75rem 0.9rem;
  border-bottom: 1px solid var(--border-color);
  color: var(--text-secondary);
}

.run-row:last-child {
  border-bottom: 0;
}

.notification-row {
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
}

.notification-row.unread {
  border-color: rgba(240, 180, 93, 0.42);
}

.error-message {
  color: var(--danger);
  font-weight: 700;
}

.status-pill.active,
.status-pill.success {
  border-color: rgba(49, 189, 145, 0.32);
  color: var(--success);
}

.status-pill.paused,
.status-pill.skipped {
  border-color: rgba(240, 180, 93, 0.32);
  color: var(--warning);
}

.status-pill.failed,
.status-pill.disabled {
  border-color: rgba(240, 120, 85, 0.32);
  color: var(--danger);
}

@media (max-width: 980px) {
  .automation-grid,
  .automation-row,
  .notification-row,
  .run-row,
  .simple-rule-controls,
  .simple-rule-grid {
    grid-template-columns: 1fr;
  }

  .row-side {
    justify-items: start;
  }
}

@media (max-width: 560px) {
  .panel-head,
  .section-title,
  .form-row {
    grid-template-columns: 1fr;
    display: grid;
  }
}
</style>
