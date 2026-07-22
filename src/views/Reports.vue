<template>
  <PageShell
    eyebrow="Relatórios"
    title="Análise do período"
    description="Veja o que aconteceu, onde variou e quais categorias explicam o mês."
    testid="reports-page"
  >
    <template #actions>
      <div class="reports-actions" aria-label="Filtros do relatório">
        <div class="scope-toggle" data-testid="family-dashboard-mode" aria-label="Escopo do relatório">
          <button type="button" :class="{ active: reportScope === 'mine' }" @click="reportScope = 'mine'">Minha visão</button>
          <button type="button" :class="{ active: reportScope === 'family' }" @click="reportScope = 'family'">Família</button>
        </div>
        <label class="period-filter" data-testid="reports-period-filter">
          <span>Período</span>
          <select v-model="selectedMonth" aria-label="Período do relatório">
            <option v-for="(name, index) in financeStore.monthNames" :key="name" :value="index + 1">
              {{ name }}/{{ selectedYear }}
            </option>
          </select>
        </label>
      </div>
    </template>

    <ResponsiveGrid variant="kpis" data-testid="reports-comparison">
      <article class="report-card">
        <span>Receitas</span>
        <strong>{{ formatMoney(current.income) }}</strong>
        <small>{{ deltaLabel(current.income, previous.income) }} vs mês anterior</small>
      </article>
      <article class="report-card">
        <span>Despesas</span>
        <strong>{{ formatMoney(current.expense) }}</strong>
        <small>{{ deltaLabel(current.expense, previous.expense) }} vs mês anterior</small>
      </article>
      <article class="report-card">
        <span>Resultado</span>
        <strong>{{ formatMoney(current.balance) }}</strong>
        <small>{{ deltaLabel(current.balance, previous.balance) }} vs mês anterior</small>
      </article>
      <article class="report-card">
        <span>Maior variação</span>
        <strong>{{ largestVariation.label }}</strong>
        <small>{{ largestVariation.detail }}</small>
      </article>
    </ResponsiveGrid>

    <ResponsiveGrid variant="sections">
      <section class="panel" data-testid="reports-category-analysis">
        <div class="panel-head">
          <h2>Gastos por categoria</h2>
          <p>Ranking do período selecionado.</p>
        </div>
        <div v-if="categoryRows.length" class="category-list">
          <div v-for="row in categoryRows" :key="row.category" class="category-row">
            <span>{{ row.category }}</span>
            <strong>{{ formatMoney(row.amount) }}</strong>
            <div class="track"><i :style="{ width: `${row.percent}%` }" /></div>
          </div>
        </div>
        <p v-else class="empty">Sem despesas no período.</p>
      </section>

      <section class="panel" data-testid="reports-trends">
        <div class="panel-head">
          <h2>Evolução temporal</h2>
          <p>Receitas, despesas e resultado nos últimos meses.</p>
        </div>
        <div class="trend-list">
          <div v-for="month in trendMonths" :key="month.key" class="trend-row">
            <span>{{ month.name }}</span>
            <strong>{{ formatMoney(month.balance) }}</strong>
            <small>R {{ compact(month.income) }} / D {{ compact(month.expense) }}</small>
          </div>
        </div>
      </section>
    </ResponsiveGrid>

    <section class="panel narrative" data-testid="reports-subscriptions-summary">
      <div class="panel-head">
        <h2>Assinaturas recorrentes</h2>
        <p>Custo equivalente e impacto previsto sem duplicar cobranças reais vinculadas.</p>
      </div>
      <p>
        Assinaturas ativas somam {{ formatMoney(subscriptionSummary.totalMonthly) }}/mês equivalente
        e {{ formatMoney(subscriptionSummary.totalAnnualized) }}/ano.
      </p>
      <p>
        Neste mês, {{ formatMoney(subscriptionSummary.monthImpact.forecastTotal) }} ainda estão previstos
        e {{ formatMoney(subscriptionSummary.monthImpact.actualLinkedTotal) }} já foram vinculados a lançamentos reais.
      </p>
    </section>

    <section class="panel narrative" data-testid="reports-monthly-narrative">
      <div class="panel-head">
        <h2>Resumo mensal</h2>
        <p>Resumo do mês com base nos seus lançamentos.</p>
      </div>
      <div v-if="current.income || current.expense">
        <p>
          No período, as receitas somaram {{ formatMoney(current.income) }} e as despesas somaram
          {{ formatMoney(current.expense) }}, gerando resultado de {{ formatMoney(current.balance) }}.
        </p>
        <p v-if="categoryRows[0]">
          A categoria com maior peso foi {{ categoryRows[0].category }}, com {{ formatMoney(categoryRows[0].amount) }}.
        </p>
      </div>
      <p v-else>Ainda não há dados suficientes para gerar um resumo mensal. Cadastre receitas e despesas para acompanhar o resultado do período.</p>
      <button class="secondary-button" type="button" @click="exportSummary">
        {{ canExportReports ? 'Exportar resumo' : 'Exportar resumo Premium' }}
      </button>
    </section>

    <section v-if="canUseAdvisorHistory" class="panel narrative" data-testid="reports-advisor-history">
      <div class="panel-head">
        <h2>Histórico do consultor</h2>
        <p>Análise consultiva calculada para o período selecionado.</p>
      </div>
      <p>Fechamento previsto: {{ formatMoney(advisorReport.snapshot.summary.projectedClosing) }}.</p>
      <p>Capacidade segura: {{ formatMoney(advisorReport.snapshot.summary.safeInvestmentCapacity) }}.</p>
      <p>Principal risco: {{ advisorReport.snapshot.summary.mainRisk }}</p>
    </section>
    <section v-else class="panel narrative premium-lock" data-testid="reports-premium-lock">
      <div class="panel-head">
        <h2>Relatórios avançados Premium</h2>
        <p>Histórico do consultor, exportações e análises avançadas ficam disponíveis no Premium.</p>
      </div>
      <button class="secondary-button" type="button" @click="goToBilling('advanced_reports')">Fazer upgrade</button>
    </section>

    <ContextualAssistant context-type="reports" />
  </PageShell>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import ContextualAssistant from '@/components/ContextualAssistant.vue'
import PageShell from '@/components/layout/PageShell.vue'
import ResponsiveGrid from '@/components/layout/ResponsiveGrid.vue'
import { usePlanAccess } from '@/composables/usePlanAccess.js'
import { useFinanceStore } from '@/stores/finance.js'
import { buildAdvisorReport } from '@/domain/predictive/index.js'
import { buildSubscriptionSummary } from '@/utils/subscriptions.js'

const financeStore = useFinanceStore()
const route = useRoute()
const router = useRouter()
const planAccess = usePlanAccess()
const selectedYear = computed(() => normalizeYear(financeStore.state.settings.year))
const selectedMonth = ref(normalizeMonth(financeStore.state.settings.selectedMonth))
const reportScope = ref('mine')

watch(
  () => financeStore.state.settings.selectedMonth,
  (month) => {
    selectedMonth.value = normalizeMonth(month)
  },
)

watch(selectedMonth, (month) => {
  financeStore.updateSettings({ selectedMonth: normalizeMonth(month) })
})

const current = computed(() => aggregateMonth(selectedYear.value, normalizeMonth(selectedMonth.value)))
const previous = computed(() => {
  const date = new Date(selectedYear.value, normalizeMonth(selectedMonth.value) - 2, 1)
  return aggregateMonth(date.getFullYear(), date.getMonth() + 1)
})
const trendMonths = computed(() => {
  const rows = []
  for (let offset = 5; offset >= 0; offset -= 1) {
    const date = new Date(selectedYear.value, normalizeMonth(selectedMonth.value) - 1 - offset, 1)
    const aggregate = aggregateMonth(date.getFullYear(), date.getMonth() + 1)
    rows.push({
      key: `${date.getFullYear()}-${date.getMonth() + 1}`,
      name: financeStore.monthNames[date.getMonth()],
      ...aggregate,
    })
  }
  return rows
})
const categoryRows = computed(() => {
  const totals = new Map()
  for (const expense of financeStore.state.expenses || []) {
    if (!isSameMonth(expense.date, selectedYear.value, normalizeMonth(selectedMonth.value))) continue
    if (expense.isInternalTransfer) continue
    const category = expense.category || 'Outros'
    totals.set(category, (totals.get(category) || 0) + Number(expense.amount || 0))
  }
  const total = [...totals.values()].reduce((sum, value) => sum + value, 0)
  return [...totals.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([category, amount]) => ({ category, amount, percent: total ? Math.round((amount / total) * 100) : 0 }))
})
const advisorReport = computed(() => buildAdvisorReport(financeStore.state, `${selectedYear.value}-${String(normalizeMonth(selectedMonth.value)).padStart(2, '0')}-15`))
const subscriptionSummary = computed(() => buildSubscriptionSummary(
  financeStore.state,
  `${selectedYear.value}-${String(normalizeMonth(selectedMonth.value)).padStart(2, '0')}-15`,
))
const canExportReports = computed(() => planAccess.canUse('export_reports'))
const canUseAdvisorHistory = computed(() => planAccess.canUse('advanced_reports') && planAccess.canUse('predictive_advisor'))
const largestVariation = computed(() => {
  const incomeDelta = Math.abs(current.value.income - previous.value.income)
  const expenseDelta = Math.abs(current.value.expense - previous.value.expense)
  if (!incomeDelta && !expenseDelta) return { label: 'Sem variação', detail: 'Ainda sem comparativo relevante.' }
  return incomeDelta >= expenseDelta
    ? { label: 'Receitas', detail: `${formatMoney(incomeDelta)} de diferença.` }
    : { label: 'Despesas', detail: `${formatMoney(expenseDelta)} de diferença.` }
})

function aggregateMonth(year, month) {
  const incomes = (financeStore.state.incomes || [])
    .filter((entry) => isSameMonth(entry.date, year, month))
    .reduce((sum, entry) => sum + Number(entry.amount || 0), 0)
  const expenses = (financeStore.state.expenses || [])
    .filter((entry) => isSameMonth(entry.date, year, month))
    .filter((entry) => !entry.isInternalTransfer)
    .reduce((sum, entry) => sum + Number(entry.amount || 0), 0)
  return { income: incomes, expense: expenses, balance: incomes - expenses }
}

function isSameMonth(value, year, month) {
  const [entryYear, entryMonth] = String(value || '').split('-').map(Number)
  return entryYear === year && entryMonth === month
}

function normalizeMonth(value) {
  const month = Number(value)
  return Number.isInteger(month) && month >= 1 && month <= 12 ? month : new Date().getMonth() + 1
}

function normalizeYear(value) {
  const year = Number(value)
  return Number.isInteger(year) && year >= 2000 ? year : new Date().getFullYear()
}

function formatMoney(value) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value || 0))
}

function compact(value) {
  return new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 }).format(Number(value || 0))
}

function deltaLabel(currentValue, previousValue) {
  if (!previousValue) return currentValue ? '+100%' : '0%'
  const delta = Math.round(((currentValue - previousValue) / Math.abs(previousValue)) * 100)
  return `${delta >= 0 ? '+' : ''}${delta}%`
}

function exportSummary() {
  if (!canExportReports.value) {
    goToBilling('export_reports')
    return
  }
  const blob = new Blob([
    `Receitas: ${current.value.income}\nDespesas: ${current.value.expense}\nResultado: ${current.value.balance}`,
  ], { type: 'text/plain' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = 'resumo-relatórios.txt'
  anchor.click()
  URL.revokeObjectURL(url)
}

function goToBilling(feature) {
  router.push({
    path: '/billing',
    query: { locked: '1', feature, from: route.fullPath },
  })
}
</script>

<style scoped>
.scope-toggle,
.period-filter,
.report-card,
.panel {
  border: 1px solid var(--divider);
  border-radius: var(--radius-sm);
  background: var(--surface-ledger);
  box-shadow: none;
}

.reports-actions {
  display: flex;
  align-items: center;
  justify-content: flex-start;
  gap: 0.5rem;
  flex-wrap: wrap;
  min-width: 0;
  max-width: 100%;
}

.period-filter {
  flex: 0 1 244px;
  min-width: 0;
  min-height: 42px;
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0 0.5rem 0 0.75rem;
  color: var(--text-secondary);
  font-size: 0.78rem;
  box-shadow: none;
}

.period-filter span {
  color: var(--text-muted);
  font-weight: 800;
  white-space: nowrap;
}

.scope-toggle {
  flex: 0 1 auto;
  min-width: 0;
  min-height: 42px;
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.25rem;
  box-shadow: none;
}

.scope-toggle button {
  border: 0;
  border-radius: var(--radius-sm);
  min-height: 32px;
  padding: 0 0.8rem;
  background: transparent;
  color: var(--text-secondary);
  font-weight: 900;
}

.scope-toggle button.active {
  background: var(--gradient-accent);
  color: #fff;
  box-shadow: 0 8px 18px color-mix(in srgb, var(--accent) 20%, transparent);
}

select {
  min-width: 0;
  width: 100%;
  min-height: 32px;
  padding: 0 0.45rem;
  border: 0;
  border-left: 1px solid var(--border-color);
  border-radius: 0;
  background: var(--bg-input);
  color: var(--text-primary);
}

select option {
  background: var(--bg-panel);
  color: var(--text-primary);
}

select:focus-visible {
  outline: none;
  border-color: var(--accent);
  box-shadow: var(--focus-ring);
}

.report-card,
.panel {
  min-width: 0;
  padding: 1rem;
  overflow: hidden;
}

.report-card {
  display: grid;
  gap: 0.45rem;
  transition: border-color 0.16s ease, box-shadow 0.16s ease, transform 0.16s ease;
}

.report-card:hover {
  border-color: color-mix(in srgb, var(--accent) 28%, var(--border-color));
  background: var(--surface-muted);
}

.report-card span,
.report-card small,
.panel-head p,
.empty,
.narrative p {
  color: var(--text-secondary);
}

.report-card strong {
  color: var(--text-primary);
  font-size: 1.25rem;
  font-variant-numeric: tabular-nums;
}

.panel-head {
  display: grid;
  gap: 0.25rem;
  margin-bottom: 0.8rem;
}

.panel-head h2 {
  margin: 0;
  color: var(--text-primary);
}

.panel-head p {
  margin: 0.25rem 0 0;
  max-width: 64ch;
}

.category-list,
.trend-list {
  display: grid;
  gap: 0.7rem;
  min-width: 0;
}

.category-row,
.trend-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 0.45rem 0.75rem;
  align-items: center;
  min-width: 0;
  padding: 0.72rem 0.8rem;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  background: color-mix(in srgb, var(--bg-hover) 74%, var(--bg-panel));
  color: var(--text-secondary);
}

.trend-row {
  grid-template-columns: minmax(7rem, 1fr) auto;
}

.category-row span,
.category-row strong,
.trend-row span,
.trend-row strong,
.trend-row small {
  min-width: 0;
  overflow-wrap: anywhere;
}

.category-row strong,
.trend-row strong {
  color: var(--text-primary);
  font-variant-numeric: tabular-nums;
}

.trend-row small {
  grid-column: 1 / -1;
  justify-self: end;
  color: var(--text-secondary);
}

.track {
  grid-column: 1 / -1;
  height: 6px;
  overflow: hidden;
  border-radius: 999px;
  background: var(--bg-elevated);
}

.track i {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: var(--gradient-accent);
}

.narrative {
  display: grid;
  gap: 0.6rem;
}

:deep(.page-header > div),
:deep(.page-header__actions) {
  min-width: 0;
}

:deep(.page-header) {
  display: grid;
  align-items: stretch;
}

:deep(.page-header__actions) {
  max-width: 100%;
}

:deep(.responsive-grid.kpis) {
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 230px), 1fr));
}

:deep(.responsive-grid.sections) {
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 360px), 1fr));
}

@media (max-width: 520px) {
  .reports-actions,
  .period-filter,
  .scope-toggle {
    width: 100%;
  }

  .scope-toggle button {
    flex: 1;
  }

  .trend-row {
    grid-template-columns: minmax(0, 1fr);
  }

  select {
    min-width: 0;
    width: 100%;
  }
}
</style>
