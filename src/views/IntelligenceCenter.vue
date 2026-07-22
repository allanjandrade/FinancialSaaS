<template>
  <main class="intelligence-page">
    <section class="intelligence-header">
      <div>
        <p class="eyebrow">Analista financeiro dinâmico</p>
        <h1>Central de Inteligência</h1>
        <p>Diagnóstico, projeção e ações calculadas a partir dos seus dados reais.</p>
      </div>
      <div class="header-status">
        <span><Database :size="15" /> {{ memoryLabel }}</span>
        <span><ShieldCheck :size="15" /> Confiança {{ intelligence.dataQuality.label }}</span>
      </div>
    </section>

    <section class="decision-hero" :class="primaryTone">
      <div class="decision-copy">
        <p class="eyebrow">Prioridade agora</p>
        <h2>{{ intelligence.headline }}</h2>
        <p>{{ primaryAction?.description || 'Nenhuma ação crítica foi identificada neste período.' }}</p>
        <router-link v-if="primaryAction?.route" class="primary-button" :to="primaryAction.route">
          Agir agora <ArrowRight :size="16" />
        </router-link>
      </div>
      <div class="decision-score">
        <span>Resultado do mês</span>
        <strong :class="{ negative: intelligence.current.surplus < 0 }">
          {{ formatCurrency(intelligence.current.surplus) }}
        </strong>
        <small>Economia de {{ formatPercent(intelligence.current.savingsRate) }}</small>
      </div>
    </section>

    <section class="answer-grid">
      <article class="answer-card">
        <div class="answer-icon current"><Activity /></div>
        <span>O que aconteceu?</span>
        <strong>{{ currentDiagnosis.title }}</strong>
        <p>{{ currentDiagnosis.detail }}</p>
      </article>
      <article class="answer-card">
        <div class="answer-icon forecast"><TrendingUp /></div>
        <span>O que pode acontecer?</span>
        <strong>{{ forecastDiagnosis.title }}</strong>
        <p>{{ forecastDiagnosis.detail }}</p>
      </article>
      <article class="answer-card">
        <div class="answer-icon action"><ListChecks /></div>
        <span>O que fazer agora?</span>
        <strong>{{ actionsCountLabel }}</strong>
        <p>{{ primaryAction?.title || 'Manter o acompanhamento mensal.' }}</p>
      </article>
    </section>

    <section class="intelligence-layout">
      <div class="main-column">
        <section class="panel action-panel">
          <div class="section-head">
            <div>
              <p class="eyebrow">Plano recomendado</p>
              <h2>Próximas ações</h2>
            </div>
            <span>{{ intelligence.actions.length }}</span>
          </div>

          <div class="action-list">
            <article v-for="(item, index) in intelligence.actions" :key="item.id" class="action-row" :class="item.severity">
              <span class="action-order">{{ index + 1 }}</span>
              <div>
                <strong>{{ item.title }}</strong>
                <p>{{ item.description }}</p>
              </div>
              <router-link v-if="item.route" :to="item.route" aria-label="Abrir ação">
                <ArrowRight :size="17" />
              </router-link>
            </article>
          </div>
        </section>

        <section class="panel analyst-panel">
          <div class="section-head">
            <div>
              <p class="eyebrow">Leitura contextual</p>
              <h2>Análise explicada por IA</h2>
            </div>
            <Sparkles :size="21" />
          </div>

          <div v-if="aiLoading" class="analyst-loading">
            <Loader2 class="spin" /> Analisando fatos e histórico relevante...
          </div>
          <div v-else-if="aiResponse" class="analyst-response">{{ aiResponse }}</div>
          <div v-else class="analyst-placeholder">
            O diagnóstico já foi calculado. Solicite uma explicação contextual para interpretar causas e alternativas.
          </div>

          <form class="analyst-question" @submit.prevent="requestExplanation">
            <input v-model.trim="question" placeholder="Ex.: Como melhorar meu caixa nos próximos 30 dias?" />
            <button class="primary-button" type="submit" :disabled="aiLoading">
              <Send :size="16" /> Analisar
            </button>
          </form>
          <p v-if="aiError" class="analyst-error">{{ aiError }}</p>
        </section>
      </div>

      <aside class="side-column">
        <section class="panel projection-panel">
          <div class="section-head compact">
            <div>
              <p class="eyebrow">Próximo ciclo</p>
              <h2>Projeção financeira</h2>
            </div>
          </div>
          <div class="projection-value" :class="{ negative: intelligence.forecast.surplus < 0 }">
            <span>Resultado projetado</span>
            <strong>{{ formatCurrency(intelligence.forecast.surplus) }}</strong>
          </div>
          <dl>
            <div><dt>Receitas</dt><dd>{{ formatCurrency(intelligence.forecast.income) }}</dd></div>
            <div><dt>Despesas</dt><dd>{{ formatCurrency(intelligence.forecast.expense) }}</dd></div>
            <div><dt>Reserva</dt><dd>{{ intelligence.reserve.coverageMonths.toFixed(1) }} meses</dd></div>
            <div><dt>Uso do cartão</dt><dd>{{ formatPercent(intelligence.card.utilization) }}</dd></div>
          </dl>
        </section>

        <section class="panel category-panel">
          <div class="section-head compact">
            <div>
              <p class="eyebrow">Comportamento</p>
              <h2>Maiores despesas</h2>
            </div>
          </div>
          <div v-if="intelligence.categories.rows.length" class="category-list">
            <div v-for="row in intelligence.categories.rows.slice(0, 5)" :key="row.category">
              <div><span>{{ row.category }}</span><strong>{{ formatCurrency(row.current) }}</strong></div>
              <div class="category-track"><span :style="{ width: categoryWidth(row.current) }" /></div>
              <small v-if="row.anomaly">{{ formatPercent(row.change) }} acima da média</small>
            </div>
          </div>
          <p v-else class="empty-copy">Ainda não há despesas suficientes para comparar categorias.</p>
        </section>

        <section class="panel memory-panel">
          <div class="memory-title"><Database :size="18" /><strong>Memória financeira</strong></div>
          <p>Salva apenas o resumo agregado do período para comparar decisões e padrões futuros.</p>
          <button class="secondary-button" type="button" :disabled="memoryLoading || !familyId" @click="saveMemory">
            {{ memoryLoading ? 'Atualizando...' : 'Atualizar memória do mês' }}
          </button>
          <small v-if="memoryMessage">{{ memoryMessage }}</small>
        </section>
      </aside>
    </section>
  </main>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import {
  Activity,
  ArrowRight,
  Database,
  ListChecks,
  Loader2,
  Send,
  ShieldCheck,
  Sparkles,
  TrendingUp,
} from 'lucide-vue-next'
import { useFinanceStore } from '@/stores/finance.js'
import { buildV3CommandCenter } from '@/domain/v3/commandCenter.js'
import { buildFinancialIntelligence } from '@/utils/financial-intelligence.js'
import { buildExecutiveSummary } from '@/utils/release7-ux.js'
import { buildSubscriptionSummary } from '@/utils/subscriptions.js'
import {
  explainFinancialAnalysis,
  rememberFinancialSnapshot,
} from '@/api/financial-analyst.js'
import { quantityLabel } from '@/utils/pt-br-copy.js'

const financeStore = useFinanceStore()
const question = ref('Quais são as três ações mais importantes para melhorar minha situação financeira?')
const aiResponse = ref('')
const aiError = ref('')
const aiLoading = ref(false)
const memoryLoading = ref(false)
const memoryState = ref('idle')
const memoryMessage = ref('')

const intelligence = computed(() =>
  buildFinancialIntelligence(financeStore.state, (month) => financeStore.calcMonth(month)))
const selectedMonth = computed(() => normalizeMonth(financeStore.state.settings.selectedMonth))
const selectedYear = computed(() => normalizeYear(financeStore.state.settings.year))
const monthData = computed(() => financeStore.calcMonth(selectedMonth.value))
const availableBalance = computed(() => monthData.value.cashBalance - monthData.value.cardBill)
const dashboardReferenceDate = computed(() => {
  const day = Math.min(new Date().getDate(), new Date(selectedYear.value, selectedMonth.value, 0).getDate())
  return `${selectedYear.value}-${String(selectedMonth.value).padStart(2, '0')}-${String(day).padStart(2, '0')}`
})
const executiveSummary = computed(() => buildExecutiveSummary(financeStore.state, financeStore.calcMonth))
const subscriptionSummary = computed(() => buildSubscriptionSummary(financeStore.state, dashboardReferenceDate.value))
const v3Command = computed(() => buildV3CommandCenter({
  state: financeStore.state,
  executiveSummary: executiveSummary.value,
  subscriptionSummary: subscriptionSummary.value,
  monthData: monthData.value,
  availableBalance: availableBalance.value,
}))
const familyId = computed(() => financeStore.state.family?.id || '')
const primaryAction = computed(() => intelligence.value.actions[0] || null)
const primaryTone = computed(() => primaryAction.value?.severity || 'info')
const actionsCountLabel = computed(() => quantityLabel(intelligence.value.actions.length, 'ação priorizada', 'ações priorizadas'))
const memoryLabel = computed(() => ({
  ready: 'Memória contextual ativa',
  empty: 'Memória pronta para aprender',
  saved: 'Memória atualizada',
  unavailable: 'Análise sem memória vetorial',
  idle: 'Memória aguardando sincronização',
}[memoryState.value] || 'Memória contextual'))

const currentDiagnosis = computed(() => {
  const data = intelligence.value.current
  if (data.surplus < 0) {
    return { title: 'O mês fechou em déficit', detail: `As despesas ultrapassaram as receitas em ${formatCurrency(Math.abs(data.surplus))}.` }
  }
  const change = data.expenseChange
  if (change != null && change >= 10) {
    return { title: 'As despesas aceleraram', detail: `O gasto ficou ${formatPercent(change)} acima do mês anterior.` }
  }
  return { title: 'O caixa permanece positivo', detail: `O período gerou ${formatCurrency(data.surplus)} de resultado.` }
})

const forecastDiagnosis = computed(() => {
  const forecast = intelligence.value.forecast
  if (forecast.surplus < 0) {
    return { title: 'Há risco de déficit', detail: `O padrão recente projeta falta de ${formatCurrency(Math.abs(forecast.surplus))}.` }
  }
  return { title: 'A projeção segue positiva', detail: `O próximo ciclo tende a preservar ${formatCurrency(forecast.surplus)}, se o padrão continuar.` }
})

function formatCurrency(value) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value || 0))
}

function formatPercent(value) {
  return `${Number(value || 0).toFixed(1)}%`
}

function normalizeMonth(value) {
  const month = Number(value)
  return Number.isInteger(month) && month >= 1 && month <= 12 ? month : new Date().getMonth() + 1
}

function normalizeYear(value) {
  const year = Number(value)
  return Number.isInteger(year) && year >= 2000 ? year : new Date().getFullYear()
}

function categoryWidth(value) {
  const max = intelligence.value.categories.rows[0]?.current || 1
  return `${Math.max(4, Math.min(100, (Number(value || 0) / max) * 100))}%`
}

async function requestExplanation() {
  aiLoading.value = true
  aiError.value = ''
  try {
    const result = await explainFinancialAnalysis({
      familyId: familyId.value,
      analysis: intelligence.value,
      question: question.value,
      commandCenter: v3Command.value,
    })
    aiResponse.value = result.response
    memoryState.value = result.memoryStatus
  } catch (error) {
    aiError.value = `${error.message}. O diagnóstico calculado continua disponível acima.`
  } finally {
    aiLoading.value = false
  }
}

async function saveMemory() {
  memoryLoading.value = true
  memoryMessage.value = ''
  try {
    const result = await rememberFinancialSnapshot(familyId.value, intelligence.value)
    memoryState.value = 'saved'
    const chunkCount = result.chunkCount || 1
    memoryMessage.value = `${quantityLabel(chunkCount, 'bloco agregado', 'blocos agregados')} ${chunkCount === 1 ? 'atualizado' : 'atualizados'}.`
  } catch (error) {
    memoryState.value = 'unavailable'
    memoryMessage.value = error.message
  } finally {
    memoryLoading.value = false
  }
}

onMounted(() => {
  requestExplanation()
})
</script>

<style scoped>
.intelligence-page { width: min(100%, 1280px); margin: 0 auto; padding: 1.25rem; display: grid; gap: 1rem; }
.intelligence-header { display: flex; justify-content: space-between; align-items: end; gap: 1rem; }
.intelligence-header h1 { margin: 0.15rem 0 0.3rem; font-family: var(--font-display); font-size: var(--page-title-size); font-weight: var(--page-title-weight); line-height: var(--page-title-line-height); letter-spacing: 0; }
.intelligence-header p { margin: 0; color: var(--text-secondary); font-family: var(--font-sans); font-size: var(--page-subtitle-size); }
.eyebrow { margin: 0; color: var(--accent); font-family: var(--font-sans); font-size: var(--text-xs); font-weight: 700; letter-spacing: var(--eyebrow-letter-spacing); text-transform: uppercase; }
.header-status { display: flex; gap: 0.5rem; flex-wrap: wrap; justify-content: flex-end; }
.header-status span { display: inline-flex; align-items: center; gap: 0.35rem; padding: 0.45rem 0.65rem; border-radius: var(--radius-sm); border: 1px solid var(--border-color); background: var(--bg-panel); color: var(--text-secondary); font-size: 0.74rem; }
.decision-hero { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 1.5rem; padding: 1.25rem; border: 1px solid var(--divider-strong); border-radius: var(--radius-sm); background: var(--surface-ledger); box-shadow: none; }
.decision-hero.critical { border-color: color-mix(in srgb, var(--expense) 42%, var(--border-color)); }
.decision-hero.opportunity { border-color: color-mix(in srgb, var(--income) 42%, var(--border-color)); }
.decision-copy h2 { margin: 0.25rem 0 0.35rem; font-size: 1.35rem; }
.decision-copy > p:not(.eyebrow) { max-width: 700px; margin: 0 0 0.9rem; color: var(--text-secondary); line-height: 1.55; }
.decision-copy .primary-button { width: fit-content; display: inline-flex; align-items: center; gap: 0.4rem; text-decoration: none; }
.decision-score { min-width: 220px; display: grid; align-content: center; padding-left: 1.25rem; border-left: 1px solid var(--border-color); }
.decision-score span, .decision-score small { color: var(--text-secondary); font-size: 0.76rem; }
.decision-score strong { margin: 0.3rem 0; color: var(--income); font-size: 1.55rem; }
.decision-score strong.negative, .projection-value.negative strong { color: var(--expense); }
.answer-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 0.8rem; }
.answer-card, .panel { background: var(--surface-ledger); border: 1px solid var(--divider); border-radius: var(--radius-sm); box-shadow: none; }
.answer-card { display: grid; grid-template-columns: auto 1fr; gap: 0.25rem 0.7rem; padding: 0.95rem; }
.answer-icon { grid-row: 1 / 4; width: 36px; height: 36px; display: grid; place-items: center; border-radius: var(--radius-md); color: var(--accent); background: var(--blue-dim); }
.answer-icon svg { width: 18px; }
.answer-icon.forecast { color: var(--warning); background: rgba(251, 191, 36, 0.12); }
.answer-icon.action { color: var(--income); background: var(--income-dim); }
.answer-card > span { color: var(--text-muted); font-size: 0.72rem; }
.answer-card > strong { font-size: 0.92rem; }
.answer-card > p { margin: 0; color: var(--text-secondary); font-size: 0.78rem; line-height: 1.45; }
.intelligence-layout { display: grid; grid-template-columns: minmax(0, 1.55fr) minmax(320px, 0.75fr); gap: 1rem; align-items: start; }
.main-column, .side-column { display: grid; gap: 1rem; }
.panel { padding: 1rem; }
.section-head { display: flex; justify-content: space-between; align-items: center; gap: 1rem; margin-bottom: 0.85rem; }
.section-head h2 { margin: 0.15rem 0 0; font-size: 1.05rem; }
.section-head > span { min-width: 30px; height: 30px; display: grid; place-items: center; border-radius: var(--radius-sm); background: var(--blue-dim); color: var(--accent); font-weight: 800; }
.action-list { display: grid; gap: 0.55rem; }
.action-row { display: grid; grid-template-columns: auto minmax(0, 1fr) auto; gap: 0.7rem; align-items: center; padding: 0.75rem; border: 1px solid var(--border-color); border-radius: var(--radius-md); background: var(--bg-elevated); }
.action-row.critical { border-left: 3px solid var(--expense); }
.action-row.warning { border-left: 3px solid var(--warning); }
.action-row.opportunity { border-left: 3px solid var(--income); }
.action-order { width: 28px; height: 28px; display: grid; place-items: center; border-radius: 50%; background: var(--bg-hover); color: var(--text-secondary); font-weight: 800; font-size: 0.78rem; }
.action-row p { margin: 0.2rem 0 0; color: var(--text-secondary); font-size: 0.8rem; line-height: 1.45; }
.action-row a { color: var(--accent); }
.analyst-response { min-height: 150px; padding: 0.9rem; border-radius: var(--radius-md); background: var(--bg-elevated); color: var(--text-secondary); line-height: 1.65; white-space: pre-wrap; }
.analyst-loading, .analyst-placeholder { min-height: 120px; display: flex; align-items: center; justify-content: center; gap: 0.5rem; padding: 1rem; border: 1px dashed var(--border-color); border-radius: var(--radius-md); color: var(--text-secondary); text-align: center; }
.spin { animation: spin 1s linear infinite; }
.analyst-question { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 0.6rem; margin-top: 0.75rem; }
.analyst-question input { width: 100%; padding: 0.75rem; }
.analyst-question button { display: inline-flex; align-items: center; gap: 0.4rem; }
.analyst-error { margin: 0.6rem 0 0; color: var(--warning); font-size: 0.78rem; }
.projection-value { padding: 0.85rem; margin-bottom: 0.65rem; border-radius: var(--radius-md); background: var(--bg-elevated); }
.projection-value span { display: block; color: var(--text-secondary); font-size: 0.76rem; }
.projection-value strong { display: block; margin-top: 0.25rem; color: var(--income); font-size: 1.4rem; }
.projection-panel dl { margin: 0; }
.projection-panel dl div { display: flex; justify-content: space-between; gap: 1rem; padding: 0.55rem 0; border-bottom: 1px solid var(--border-color); }
.projection-panel dt { color: var(--text-secondary); }
.projection-panel dd { margin: 0; font-weight: 700; }
.category-list { display: grid; gap: 0.7rem; }
.category-list > div > div:first-child { display: flex; justify-content: space-between; gap: 0.75rem; font-size: 0.8rem; }
.category-track { height: 5px; margin-top: 0.35rem; border-radius: 999px; overflow: hidden; background: var(--bg-hover); }
.category-track span { display: block; height: 100%; border-radius: inherit; background: var(--accent); }
.category-list small { color: var(--warning); font-size: 0.7rem; }
.empty-copy, .memory-panel p { color: var(--text-secondary); font-size: 0.8rem; line-height: 1.5; }
.memory-title { display: flex; align-items: center; gap: 0.5rem; }
.memory-title svg { color: var(--accent); }
.memory-panel button { width: 100%; }
.memory-panel small { display: block; margin-top: 0.55rem; color: var(--text-secondary); }
@keyframes spin { to { transform: rotate(360deg); } }
@media (max-width: 980px) {
  .intelligence-layout { grid-template-columns: 1fr; }
  .side-column { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .memory-panel { grid-column: 1 / -1; }
}
@media (max-width: 760px) {
  .intelligence-header, .decision-hero { grid-template-columns: 1fr; align-items: start; }
  .intelligence-header { display: grid; }
  .header-status { justify-content: flex-start; }
  .decision-score { min-width: 0; padding: 0.85rem 0 0; border-left: 0; border-top: 1px solid var(--border-color); }
  .answer-grid, .side-column { grid-template-columns: 1fr; }
  .memory-panel { grid-column: auto; }
}
@media (max-width: 560px) {
  .intelligence-page { padding: 0.8rem; }
  .analyst-question { grid-template-columns: 1fr; }
  .action-row { grid-template-columns: auto minmax(0, 1fr); }
  .action-row a { grid-column: 2; }
}
</style>
