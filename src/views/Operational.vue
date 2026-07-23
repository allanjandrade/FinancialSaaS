<template>
  <div v-if="accessChecked && !canSeeOperational" class="operation-shell operational-view" data-testid="operational-blocked">
    <section class="panel operation-empty-panel">
      <p class="eyebrow">Acesso restrito</p>
      <h1>Painel operacional</h1>
      <p>Acesso restrito a owner e admin.</p>
    </section>
  </div>

  <div v-else class="operation-shell operational-view" data-testid="operational-control-room">
    <div data-testid="operational-page">
      <section class="operation-hero" data-testid="operation-hero">
        <div>
          <p class="eyebrow">Sala de controle</p>
          <h1>Painel operacional</h1>
          <p>Eventos técnicos, auditoria e saúde do ambiente sem expor senhas, tokens ou prompts completos.</p>
        </div>
        <div class="operation-hero-actions">
          <span class="status-chip">{{ health?.status || 'carregando' }}</span>
          <DiagnosticsExportButton :period-days="periodDays" @exported="onExported" @error="showError" />
        </div>
      </section>

      <p v-if="error" class="error-message">{{ error }}</p>

      <section class="operational-command-grid">
        <OperationalSummaryCards :summary="summary" />
      </section>

      <section class="panel operational-control-bar">
        <label>
          Período
          <select v-model.number="periodDays" data-testid="operational-period" @change="loadAll">
            <option :value="7">7 dias</option>
            <option :value="30">30 dias</option>
            <option :value="90">90 dias</option>
          </select>
        </label>
        <label>
          Fonte
          <select v-model="source" data-testid="operational-source" @change="loadEvents">
            <option value="">Todas</option>
            <option value="ai_assist">AI Assist</option>
            <option value="ai_action">Ações IA</option>
            <option value="automation">Automações</option>
            <option value="financial_engine">Motor financeiro</option>
            <option value="edge_function">Funções</option>
            <option value="system">Sistema</option>
          </select>
        </label>
        <label>
          Severidade
          <select v-model="severity" data-testid="operational-severity" @change="loadEvents">
            <option value="">Todas</option>
            <option value="info">Info</option>
            <option value="warning">Aviso</option>
            <option value="error">Erro</option>
            <option value="critical">Crítico</option>
          </select>
        </label>
        <button type="button" class="secondary-button" data-testid="operational-refresh" @click="loadAll">Atualizar</button>
      </section>

      <div class="operation-layout">
        <main class="operation-main">
          <section class="panel">
            <div class="section-title">
              <div>
                <p class="eyebrow">Fluxo recente</p>
                <h2>Últimos eventos</h2>
              </div>
              <span class="status-pill">{{ events.length }}</span>
            </div>
            <OperationalEventList :events="events" />
          </section>

          <section class="panel">
            <div class="section-title">
              <div>
                <p class="eyebrow">Risco operacional</p>
                <h2>Erros recentes</h2>
              </div>
              <span class="status-pill danger">{{ errors.length }}</span>
            </div>
            <OperationalEventList :events="errors" />
          </section>
        </main>

        <aside class="operational-side-panel operation-side-panel">
          <section class="panel" data-testid="operational-health">
            <div class="section-title">
              <div>
                <p class="eyebrow">Saúde das funções</p>
                <h2>Status das funções</h2>
              </div>
              <span class="status-pill">{{ health?.status || 'carregando' }}</span>
            </div>
            <div class="health-grid">
              <span v-for="(value, key) in health?.checks || {}" :key="key">{{ key }}: {{ value }}</span>
            </div>
          </section>

          <section class="panel" data-testid="operational-ai-audit">
            <div class="section-title">
              <div>
                <p class="eyebrow">Auditoria</p>
                <h2>Ações IA</h2>
              </div>
              <span class="status-pill">{{ aiActions.length }}</span>
            </div>
            <p v-if="!aiActions.length" class="empty">Nenhuma ação confirmada no período.</p>
            <ul v-else class="audit-list">
              <li v-for="item in aiActions" :key="item.id">
                <strong>{{ item.action_type }}</strong>
                <span>{{ item.reverted_at ? 'revertida' : 'confirmada' }}</span>
              </li>
            </ul>
          </section>

          <section class="panel" data-testid="operational-automation-audit">
            <div class="section-title">
              <div>
                <p class="eyebrow">Rotinas</p>
                <h2>Automações</h2>
              </div>
              <span class="status-pill">{{ automationRuns.length }}</span>
            </div>
            <p v-if="!automationRuns.length" class="empty">Nenhuma execução no período.</p>
            <ul v-else class="audit-list">
              <li v-for="run in automationRuns" :key="run.id">
                <strong>{{ run.template_id }}</strong>
                <span>{{ run.status }} · {{ run.triggered ? 'alerta' : 'sem alerta' }}</span>
              </li>
            </ul>
          </section>
        </aside>
      </div>
    </div>
  </div>
</template>

<script setup>
import { onMounted, ref } from 'vue'
import DiagnosticsExportButton from '@/components/DiagnosticsExportButton.vue'
import OperationalEventList from '@/components/OperationalEventList.vue'
import OperationalSummaryCards from '@/components/OperationalSummaryCards.vue'
import {
  getAiActionsAudit,
  getAutomationsAudit,
  getErrorQueue,
  getHealthCheck,
  getOperationalSummary,
  getRecentEvents,
} from '@/api/operational-insights.js'
import { useNotification } from '@/composables/useNotification'
import { resolveFrontendAccess } from '@/domain/access-control.js'
import { invokeAuthenticatedFunction } from '@/lib/supabase-auth.js'

const { showToast } = useNotification()
const periodDays = ref(7)
const source = ref('')
const severity = ref('')
const summary = ref({})
const events = ref([])
const errors = ref([])
const aiActions = ref([])
const automationRuns = ref([])
const health = ref(null)
const error = ref('')
const accessChecked = ref(false)
const canSeeOperational = ref(false)

async function loadEvents() {
  const result = await getRecentEvents({ periodDays: periodDays.value, limit: 50, source: source.value, severity: severity.value })
  events.value = result.events || []
}

async function loadAll() {
  error.value = ''
  try {
    const [summaryResult, eventsResult, errorsResult, aiResult, automationResult, healthResult] = await Promise.all([
      getOperationalSummary(periodDays.value),
      getRecentEvents({ periodDays: periodDays.value, limit: 50, source: source.value, severity: severity.value }),
      getErrorQueue(periodDays.value),
      getAiActionsAudit(periodDays.value),
      getAutomationsAudit(periodDays.value),
      getHealthCheck(),
    ])
    summary.value = summaryResult.summary || {}
    events.value = eventsResult.events || []
    errors.value = errorsResult.events || []
    aiActions.value = aiResult.ai_actions || []
    automationRuns.value = automationResult.runs || []
    health.value = healthResult
  } catch (err) {
    showError(err)
  }
}

function onExported() {
  showToast('Diagnóstico exportado sem dados sensíveis.', 'success')
}

function showError(err) {
  error.value = err?.message || 'Não foi possível carregar o painel operacional.'
  showToast(error.value, 'error')
}

async function loadAccess() {
  try {
    const { data, error: accessError } = await invokeAuthenticatedFunction('admin-current-user')
    const access = resolveFrontendAccess({ admin: accessError ? null : data })
    canSeeOperational.value = access.isOperationalAdmin
  } catch {
    canSeeOperational.value = false
  } finally {
    accessChecked.value = true
  }
}

onMounted(async () => {
  await loadAccess()
  if (canSeeOperational.value) await loadAll()
})
</script>

<style scoped>
.operation-shell {
  width: min(var(--content-max), 100%);
  min-height: 100%;
  display: grid;
  gap: 1rem;
  margin: 0 auto;
  padding: var(--content-pad);
}

.operation-shell > div {
  display: grid;
  gap: 1rem;
}

.operation-hero {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 1rem;
  padding-bottom: 1rem;
  border-bottom: 1px solid var(--border-color);
}

.operation-hero h1,
.operation-hero p,
.operation-empty-panel h1,
.operation-empty-panel p {
  margin: 0;
}

.operation-hero h1,
.operation-empty-panel h1 {
  color: var(--text-primary);
  font-family: var(--font-display);
  font-size: var(--page-title-size);
  font-weight: var(--page-title-weight);
  line-height: var(--page-title-line-height);
}

.operation-hero > div > p:not(.eyebrow),
.operation-empty-panel p {
  max-width: 760px;
  margin-top: 0.35rem;
  color: var(--text-secondary);
  line-height: 1.5;
}

.operation-hero-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 0.55rem;
  flex-wrap: wrap;
}

.operation-layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(320px, 0.36fr);
  gap: 1rem;
  align-items: start;
}

.operation-main,
.operation-side-panel {
  min-width: 0;
  display: grid;
  gap: 1rem;
}

.panel {
  background: var(--surface-ledger);
  border: 1px solid var(--divider);
  border-radius: var(--radius-sm);
  padding: 1.25rem;
  box-shadow: none;
}

.operation-empty-panel {
  min-height: 280px;
  display: grid;
  place-items: center;
  text-align: center;
}

.operational-command-grid :deep(.summary-card) {
  border: 1px solid var(--divider);
  border-radius: var(--radius-sm);
  background: var(--surface-ledger);
  box-shadow: none;
}

.operational-control-bar {
  display: grid;
  grid-template-columns: repeat(3, minmax(150px, 1fr)) auto;
  gap: 0.75rem;
  align-items: end;
}

.operational-control-bar label {
  display: grid;
  gap: 0.35rem;
  color: var(--text-secondary);
  font-size: 0.84rem;
  font-weight: 800;
}

.operational-control-bar select {
  min-height: 40px;
  padding: 0.55rem 0.7rem;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  background: var(--bg-input);
  color: var(--text-primary);
}

.section-title {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 1rem;
}

.section-title h2 {
  margin: 0;
  color: var(--text-primary);
  font-size: 1.02rem;
}

.status-chip,
.status-pill {
  min-height: 28px;
  display: inline-flex;
  align-items: center;
  padding: 0.25rem 0.6rem;
  border-radius: 999px;
  background: var(--blue-dim);
  color: var(--accent);
  font-size: 0.74rem;
  font-weight: 800;
  white-space: nowrap;
}

.status-pill.danger {
  background: rgba(239, 68, 68, 0.12);
  color: #ef4444;
}

.audit-list {
  display: grid;
  gap: 0.6rem;
  margin: 0;
  padding: 0;
  list-style: none;
}

.audit-list li {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  padding: 0.75rem;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  background: var(--bg-elevated);
}

.audit-list strong {
  color: var(--text-primary);
}

.audit-list span,
.health-grid,
.empty {
  color: var(--text-secondary);
}

.health-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 0.65rem;
}

.health-grid span {
  min-width: 0;
  padding: 0.55rem 0.65rem;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  background: var(--bg-elevated);
  overflow-wrap: anywhere;
}

.error-message {
  margin: 0;
  padding: 0.75rem 0.9rem;
  border: 1px solid rgba(239, 68, 68, 0.22);
  border-radius: 8px;
  background: rgba(239, 68, 68, 0.08);
  color: var(--danger);
  font-weight: 800;
}

@media (max-width: 980px) {
  .operation-hero {
    align-items: flex-start;
    flex-direction: column;
  }

  .operation-layout,
  .operational-control-bar {
    grid-template-columns: minmax(0, 1fr);
  }

  .operation-hero-actions {
    width: 100%;
  }
}
</style>
