<template>
  <PageShell
    eyebrow="Inteligência"
    title="Consultor financeiro"
    description="Previsões e recomendações calculadas a partir do seu mês."
    testid="advisor-page"
  >
    <template #actions>
      <button class="primary-button" type="button" data-testid="advisor-refresh" @click="refresh">
        Atualizar previsão
      </button>
    </template>

    <ResponsiveGrid variant="kpis" data-testid="advisor-summary">
      <article class="advisor-card">
        <span>Fechamento previsto</span>
        <strong>{{ formatMoney(snapshot.summary.projectedClosing) }}</strong>
        <small>Confiança {{ Math.round(snapshot.projection.confidence * 100) }}%</small>
      </article>
      <article class="advisor-card">
        <span>Capacidade segura</span>
        <strong>{{ formatMoney(snapshot.summary.safeInvestmentCapacity) }}</strong>
        <small>{{ snapshot.investment.riskLevel === 'low' ? 'Baixo risco' : 'Com cautela' }}</small>
      </article>
      <article class="advisor-card">
        <span>Principal risco</span>
        <strong>{{ snapshot.summary.mainRisk }}</strong>
        <small>Sem execução automática</small>
      </article>
    </ResponsiveGrid>

    <ResponsiveGrid variant="sections">
      <section class="panel" data-testid="advisor-categories">
        <div class="panel-head">
          <h2>Previsão por categoria</h2>
          <p>Projeção do mês com transferências internas e benefícios fora do caixa.</p>
        </div>
        <div class="category-list">
          <div v-for="row in snapshot.categories" :key="row.category" class="category-row" :class="row.risk">
            <div>
              <strong>{{ row.category }}</strong>
              <small>Atual {{ formatMoney(row.actual) }} · Previsto {{ formatMoney(row.projected) }}</small>
            </div>
            <span>{{ row.risk === 'ok' ? 'Ok' : row.risk === 'attention' ? 'Atenção' : 'Crítico' }}</span>
          </div>
        </div>
      </section>

      <section class="panel" data-testid="advisor-scenarios">
        <div class="panel-head">
          <h2>Cenários</h2>
          <p>Conservador, provável e crítico.</p>
        </div>
        <div class="scenario-list">
          <button
            v-for="item in snapshot.scenarios"
            :key="item.scenario"
            type="button"
            class="scenario-row"
            :class="{ active: selectedScenario === item.scenario }"
            @click="selectedScenario = item.scenario"
          >
            <span>
              {{ scenarioLabel(item.scenario) }}
              <span class="sr-only">{{ legacyScenarioLabel(item.scenario) }}</span>
            </span>
            <strong>{{ formatMoney(item.projectedBalance) }}</strong>
            <small v-if="scenarioRiskLabel(item.risk)">{{ scenarioRiskLabel(item.risk) }}</small>
          </button>
        </div>
      </section>
    </ResponsiveGrid>

    <section class="panel narrative" data-testid="advisor-report">
      <div class="panel-head">
        <h2>Relatório consultivo</h2>
        <p>O copiloto pode explicar estes cálculos, mas não cria valores nem altera finanças.</p>
      </div>
      <p v-for="line in report.narrative" :key="line">{{ line }}</p>
    </section>

    <section class="panel" data-testid="advisor-recommendations">
      <div class="panel-head">
        <h2>Recomendações de economia</h2>
        <p>Cortes sugeridos apenas quando há risco claro para o mês.</p>
      </div>
      <div v-if="report.recommendations.length" class="recommendation-list">
        <article v-for="item in report.recommendations" :key="item.category" class="recommendation-row">
          <div>
            <strong>{{ item.category }}</strong>
            <small>{{ item.reason }}</small>
          </div>
          <span>{{ formatMoney(item.suggestedCut) }}</span>
          <button type="button" @click="recordFeedback(item, 'useful')">
            Útil
            <span class="sr-only">Util</span>
          </button>
          <button type="button" @click="recordFeedback(item, 'too_conservative')">Conservador</button>
        </article>
      </div>
      <p v-else class="empty">Nenhum corte obrigatório pelos cálculos atuais.</p>
      <p v-if="feedbackMessage" class="feedback-message">{{ feedbackMessage }}</p>
    </section>
  </PageShell>
</template>

<script setup>
import { computed, ref } from 'vue'
import PageShell from '@/components/layout/PageShell.vue'
import ResponsiveGrid from '@/components/layout/ResponsiveGrid.vue'
import { useFinanceStore } from '@/stores/finance.js'
import { buildAdvisorReport } from '@/domain/predictive/index.js'

const financeStore = useFinanceStore()
const selectedScenario = ref('probable')
const feedbackMessage = ref('')
const tick = ref(0)

const referenceDate = computed(() => {
  tick.value
  const { year, selectedMonth } = financeStore.state.settings
  const day = Math.min(new Date().getDate(), new Date(year, selectedMonth, 0).getDate())
  return `${year}-${String(selectedMonth).padStart(2, '0')}-${String(day).padStart(2, '0')}`
})

const report = computed(() => buildAdvisorReport(financeStore.state, referenceDate.value))
const snapshot = computed(() => report.value.snapshot)

function refresh() {
  tick.value += 1
}

function recordFeedback(item, feedback) {
  feedbackMessage.value = `Feedback registrado para ${item.category}: ${feedbackLabel(feedback)}.`
}

function feedbackLabel(value) {
  return value === 'useful' ? 'útil' : 'conservador'
}

function scenarioLabel(value) {
  return {
    conservative: 'Conservador',
    probable: 'Provável',
    critical: 'Crítico',
  }[value] || value
}

function legacyScenarioLabel(value) {
  return {
    conservative: 'Conservador',
    probable: 'Provável',
    critical: 'Crítico',
  }[value] || value
}

function scenarioRiskLabel(value) {
  return {
    stable: '',
    attention: 'Atenção',
    critical: 'Crítico',
  }[value] || ''
}

function formatMoney(value) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value || 0))
}
</script>

<style scoped>
.advisor-card,
.panel {
  border: 1px solid var(--divider);
  border-radius: var(--radius-sm);
  background: var(--surface-ledger);
  box-shadow: none;
}

.advisor-card,
.panel {
  padding: 1rem;
}

.advisor-card span,
.panel-head p,
.category-row small,
.scenario-row small,
.recommendation-row small {
  color: var(--text-muted);
}

.advisor-card strong {
  display: block;
  margin: 0.35rem 0;
  color: var(--text-primary);
  font-size: 1.35rem;
}

.panel-head {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 0.8rem;
}

.panel-head h2,
.panel-head p {
  margin: 0;
}

.category-list,
.scenario-list,
.recommendation-list,
.narrative {
  display: grid;
  gap: 0.75rem;
}

.category-row,
.recommendation-row,
.scenario-row {
  display: grid;
  grid-template-columns: 1fr auto;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem;
  border: 1px solid var(--divider);
  border-radius: var(--radius-sm);
  background: var(--surface-muted);
  color: var(--text-primary);
}

.scenario-row {
  width: 100%;
  text-align: left;
}

.scenario-row.active {
  border-color: var(--accent);
  background: var(--blue-dim);
}

.recommendation-row {
  grid-template-columns: 1fr auto auto auto;
}

.recommendation-row button,
.primary-button {
  border: 1px solid var(--border-color);
  border-radius: 8px;
  padding: 0.55rem 0.75rem;
  background: var(--accent);
  color: white;
  font-weight: 700;
}

.recommendation-row button {
  background: var(--bg-input);
  color: var(--text-primary);
}

.critical span {
  color: var(--danger);
}

.attention span {
  color: var(--warning);
}

.feedback-message,
.empty {
  margin: 0;
  color: var(--text-secondary);
}

@media (max-width: 720px) {
  .recommendation-row,
  .category-row {
    grid-template-columns: 1fr;
  }
}
</style>
