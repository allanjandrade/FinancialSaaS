<template>
  <PageShell
    eyebrow="Version 3.0"
    title="Central de Comando"
    description="Score financeiro, plano do mês e ações priorizadas a partir dos seus dados reais."
    testid="command-center-page"
  >
    <template #actions>
      <router-link class="secondary-button" to="/analysis">Abrir análises</router-link>
    </template>

    <section class="command-hero" :class="command.mode" data-testid="command-center-page">
      <div class="hero-copy">
        <span>Diretriz do mês</span>
        <h2>{{ command.northStar }}</h2>
        <p>{{ command.description }}</p>
        <div class="hero-actions">
          <button class="primary-button" type="button" @click="runAction(command.primaryAction)">
            {{ command.primaryAction.label }}
            <ArrowRight />
          </button>
          <router-link class="ghost-link" to="/ai">Perguntar ao copiloto</router-link>
        </div>
      </div>

      <aside class="score-card" data-testid="v3-financial-score">
        <span>Score Financeiro V3</span>
        <strong>{{ command.score.score }}</strong>
        <small>{{ command.score.label }} · {{ selectedMonthLabel }}</small>
      </aside>
    </section>

    <section class="pillar-grid" aria-label="Pilares do score financeiro">
      <article v-for="pillar in command.score.pillars" :key="pillar.key" class="pillar-card" :class="pillar.tone">
        <div>
          <span>{{ pillar.label }}</span>
          <strong>{{ pillar.score }}</strong>
        </div>
        <p>{{ pillar.detail }}</p>
        <div class="pillar-track"><i :style="{ width: `${pillar.score}%` }" /></div>
      </article>
    </section>

    <FinancialOSMap data-testid="v3-operating-system-map" :system="operatingSystem" />

    <section class="command-layout">
      <article class="panel action-plan" data-testid="v3-action-plan">
        <header>
          <div>
            <span>Plano de ação</span>
            <h2>Prioridade executável</h2>
          </div>
          <strong>{{ command.actionPlan.length }}</strong>
        </header>

        <div class="action-list">
          <button
            v-for="(item, index) in command.actionPlan"
            :key="item.key"
            type="button"
            class="action-item"
            :class="item.priority"
            @click="runAction(item)"
          >
            <b>{{ index + 1 }}</b>
            <span>
              <strong>{{ item.label }}</strong>
              <small>{{ item.detail }}</small>
            </span>
            <em>{{ priorityLabel(item.priority) }}</em>
          </button>
        </div>
      </article>

      <aside class="panel execution-rails" data-testid="v3-execution-rails">
        <header>
          <div>
            <span>Trilhos de execução</span>
            <h2>O que muda agora</h2>
          </div>
        </header>

        <div class="rail-list">
          <article>
            <span>Agora</span>
            <strong>{{ command.primaryAction.label }}</strong>
            <small>{{ command.primaryAction.detail }}</small>
          </article>
          <article>
            <span>Impacto estimado</span>
            <strong class="money">{{ formatCurrency(totalEstimatedImpact) }}</strong>
            <small>Somatório das ações priorizadas com valor estimado.</small>
          </article>
          <article>
            <span>Fatos para IA</span>
            <strong>{{ command.score.label }} · {{ aiFacts.actions.length }} ações</strong>
            <small>O copiloto pode explicar o score sem resposta genérica.</small>
          </article>
        </div>
      </aside>
    </section>
  </PageShell>
</template>

<script setup>
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { ArrowRight } from 'lucide-vue-next'
import PageShell from '@/components/layout/PageShell.vue'
import FinancialOSMap from '@/components/v3/FinancialOSMap.vue'
import { useFinanceStore } from '@/stores/finance.js'
import { buildExecutiveSummary } from '@/utils/release7-ux.js'
import { buildSubscriptionSummary } from '@/utils/subscriptions.js'
import { buildV3CommandCenter, v3CommandFactsForAI } from '@/domain/v3/commandCenter.js'
import { buildV3OperatingSystem } from '@/domain/v3/financialOperatingSystem.js'

const router = useRouter()
const financeStore = useFinanceStore()

const selectedMonth = computed(() => normalizeMonth(financeStore.state.settings.selectedMonth))
const selectedYear = computed(() => normalizeYear(financeStore.state.settings.year))
const selectedMonthLabel = computed(() => `${financeStore.monthNames[selectedMonth.value - 1]}/${selectedYear.value}`)
const monthData = computed(() => financeStore.calcMonth(selectedMonth.value))
const availableBalance = computed(() => monthData.value.cashBalance - monthData.value.cardBill)
const executiveSummary = computed(() => buildExecutiveSummary(financeStore.state, financeStore.calcMonth))
const dashboardReferenceDate = computed(() => {
  const day = Math.min(new Date().getDate(), new Date(selectedYear.value, selectedMonth.value, 0).getDate())
  return `${selectedYear.value}-${String(selectedMonth.value).padStart(2, '0')}-${String(day).padStart(2, '0')}`
})
const subscriptionSummary = computed(() => buildSubscriptionSummary(financeStore.state, dashboardReferenceDate.value))
const command = computed(() => buildV3CommandCenter({
  state: financeStore.state,
  executiveSummary: executiveSummary.value,
  subscriptionSummary: subscriptionSummary.value,
  monthData: monthData.value,
  availableBalance: availableBalance.value,
}))
const aiFacts = computed(() => v3CommandFactsForAI(command.value))
const operatingSystem = computed(() => buildV3OperatingSystem({
  command: command.value,
  state: financeStore.state,
  monthData: monthData.value,
  availableBalance: availableBalance.value,
}))
const totalEstimatedImpact = computed(() => command.value.actionPlan
  .reduce((sum, item) => sum + Number(item.estimatedImpactAmount || 0), 0))

function normalizeMonth(value) {
  const month = Number(value)
  return Number.isInteger(month) && month >= 1 && month <= 12 ? month : new Date().getMonth() + 1
}

function normalizeYear(value) {
  const year = Number(value)
  return Number.isInteger(year) && year >= 2000 ? year : new Date().getFullYear()
}

function priorityLabel(priority) {
  return {
    critical: 'Crítico',
    high: 'Alta',
    medium: 'Média',
    low: 'Baixa',
  }[priority] || 'Média'
}

function formatCurrency(value) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value || 0))
}

function runAction(action) {
  if (!action?.route) return
  router.push(action.route)
}
</script>

<style scoped>
.secondary-button,
.primary-button,
.ghost-link {
  min-height: 40px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.45rem;
  border-radius: 8px;
  padding: 0 0.9rem;
  font-weight: 900;
  text-decoration: none;
}

.secondary-button,
.ghost-link {
  border: 1px solid var(--border-color);
  background: var(--bg-elevated);
  color: var(--text-primary);
}

.primary-button {
  border: 0;
  background: var(--accent);
  color: #fff;
  cursor: pointer;
}

.primary-button svg {
  width: 15px;
}

.command-hero {
  min-height: 260px;
  display: grid;
  grid-template-columns: minmax(0, 1fr) 260px;
  align-items: stretch;
  gap: 1rem;
}

.hero-copy,
.score-card,
.panel,
.pillar-card {
  border: 1px solid var(--divider);
  border-radius: var(--radius-sm);
  background: var(--surface-ledger);
  box-shadow: none;
}

.hero-copy {
  padding: clamp(1.2rem, 3vw, 2rem);
  display: grid;
  align-content: center;
  gap: 0.65rem;
}

.hero-copy > span,
.panel header span,
.pillar-card span,
.score-card span,
.rail-list span {
  color: var(--accent);
  font-size: var(--text-xs);
  font-weight: 900;
  letter-spacing: var(--eyebrow-letter-spacing);
  text-transform: uppercase;
}

.hero-copy h2 {
  max-width: 760px;
  margin: 0;
  font-size: clamp(1.6rem, 4vw, 2.7rem);
  line-height: 1.05;
}

.hero-copy p {
  max-width: 760px;
  margin: 0;
  color: var(--text-secondary);
  line-height: 1.6;
}

.hero-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.65rem;
  margin-top: 0.45rem;
}

.score-card {
  display: grid;
  place-content: center;
  gap: 0.35rem;
  padding: 1.25rem;
  text-align: center;
}

.score-card strong {
  color: var(--accent);
  font-size: clamp(3rem, 8vw, 5.5rem);
  line-height: 0.95;
}

.score-card small,
.pillar-card p,
.rail-list small,
.action-item small {
  color: var(--text-secondary);
  line-height: 1.4;
}

.pillar-grid {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 0.85rem;
}

.pillar-card {
  padding: 0.9rem;
  display: grid;
  gap: 0.6rem;
}

.pillar-card > div {
  display: flex;
  justify-content: space-between;
  gap: 0.75rem;
}

.pillar-card strong {
  color: var(--text-primary);
  font-size: 1.2rem;
}

.pillar-card p {
  margin: 0;
  font-size: 0.78rem;
}

.pillar-track {
  height: 6px;
  overflow: hidden;
  border-radius: 999px;
  background: var(--bg-elevated);
}

.pillar-track i {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: var(--accent);
}

.pillar-card.income .pillar-track i { background: var(--income); }
.pillar-card.expense .pillar-track i { background: var(--expense); }
.pillar-card.warning .pillar-track i { background: #fbbf24; }

.command-layout {
  display: grid;
  grid-template-columns: minmax(0, 1.35fr) minmax(280px, 0.65fr);
  gap: 1rem;
  align-items: start;
}

.panel {
  overflow: hidden;
}

.panel header {
  min-height: 70px;
  padding: 1rem;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  border-bottom: 1px solid var(--border-color);
}

.panel header h2 {
  margin: 0.15rem 0 0;
  font-size: 1.05rem;
}

.panel header > strong {
  color: var(--accent);
  font-size: 1.8rem;
}

.action-list,
.rail-list {
  display: grid;
  gap: 0.75rem;
  padding: 1rem;
}

.action-item {
  width: 100%;
  min-width: 0;
  display: grid;
  grid-template-columns: 34px minmax(0, 1fr) auto;
  align-items: center;
  gap: 0.8rem;
  border: 1px solid var(--border-color);
  border-radius: 10px;
  padding: 0.82rem;
  background: var(--bg-elevated);
  color: inherit;
  cursor: pointer;
  text-align: left;
}

.action-item:hover {
  border-color: color-mix(in srgb, var(--accent) 32%, var(--border-color));
  background: var(--bg-hover);
}

.action-item b {
  width: 34px;
  height: 34px;
  display: grid;
  place-items: center;
  border-radius: 999px;
  background: var(--blue-dim);
  color: var(--accent);
}

.action-item span {
  min-width: 0;
  display: grid;
  gap: 0.18rem;
}

.action-item span strong {
  color: var(--text-primary);
}

.action-item em {
  border-radius: 999px;
  padding: 0.28rem 0.55rem;
  background: var(--bg-card);
  color: var(--text-secondary);
  font-size: 0.72rem;
  font-style: normal;
  font-weight: 900;
}

.action-item.critical em { color: var(--expense); background: var(--expense-dim); }
.action-item.high em { color: #b45309; background: rgba(251, 191, 36, 0.16); }

.rail-list article {
  display: grid;
  gap: 0.25rem;
  border: 1px solid var(--border-color);
  border-radius: 10px;
  padding: 0.85rem;
  background: var(--bg-elevated);
}

.rail-list strong {
  color: var(--text-primary);
}

@media (max-width: 1060px) {
  .command-hero,
  .command-layout {
    grid-template-columns: 1fr;
  }

  .pillar-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 560px) {
  .pillar-grid {
    grid-template-columns: 1fr;
  }

  .action-item {
    grid-template-columns: 30px minmax(0, 1fr);
  }

  .action-item em {
    grid-column: 2;
    justify-self: start;
  }
}
</style>
