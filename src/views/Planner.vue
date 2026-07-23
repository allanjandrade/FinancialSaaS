<template>
  <main class="planning-page" data-testid="release8-planning">
    <section class="page-head">
      <div>
        <p class="eyebrow">Planejamento</p>
        <h1>Plano do mês</h1>
        <span class="sr-only">Plano do mês</span>
        <p>Metas, orçamento, compras e aportes calculados a partir do seu mês.</p>
      </div>
      <div class="risk-pill" :class="monthlyPlan.month_risk">
        Risco: {{ riskLabel(monthlyPlan.month_risk) }}
      </div>
    </section>

    <section class="summary-grid" aria-label="Resumo do plano">
      <article>
        <span>Receita em dinheiro</span>
        <strong>{{ formatMoney(monthlyPlan.income_cash) }}</strong>
      </article>
      <article>
        <span>Fatura projetada</span>
        <strong>{{ formatMoney(monthlyPlan.projected_card_bill) }}</strong>
      </article>
      <article>
        <span>Saldo seguro</span>
        <strong>{{ formatMoney(monthlyPlan.safe_balance) }}</strong>
      </article>
      <article>
        <span>Livre para compras</span>
        <strong>{{ formatMoney(monthlyPlan.free_amount_for_purchases) }}</strong>
      </article>
      <article>
        <span>Aporte sugerido</span>
        <strong>{{ formatMoney(investment.safe_contribution) }}</strong>
      </article>
    </section>

    <section class="content-grid">
      <article id="goals" class="panel" data-testid="planning-goals">
        <div class="section-title">
          <div>
            <p class="eyebrow">Metas</p>
            <h2>Objetivos financeiros</h2>
          </div>
          <Target />
        </div>
        <form class="form-grid" @submit.prevent="addGoal">
          <label>
            Nome
            <input v-model="goalForm.name" data-testid="goal-name" required />
          </label>
          <label>
            Tipo
            <select v-model="goalForm.type" data-testid="goal-type">
              <option v-for="type in goalTypes" :key="type" :value="type">{{ typeLabel(type) }}</option>
            </select>
          </label>
          <label>
            Valor alvo
            <input v-model.number="goalForm.target_amount" data-testid="goal-target" type="number" min="0" step="0.01" required />
          </label>
          <label>
            Valor atual
            <input v-model.number="goalForm.current_amount" type="number" min="0" step="0.01" />
          </label>
          <label>
            Aporte mensal
            <input v-model.number="goalForm.monthly_contribution" type="number" min="0" step="0.01" />
          </label>
          <label>
            Data alvo
            <input v-model="goalForm.target_date" type="date" />
          </label>
          <button class="primary-button" data-testid="goal-submit" type="submit">Salvar meta</button>
        </form>
        <div class="goal-list">
          <article v-for="goal in goals" :key="goal.id" class="mini-card">
            <strong>{{ goal.name }}</strong>
            <span>{{ typeLabel(goal.type) }}</span>
            <progress :value="goal.current_amount" :max="Math.max(goal.target_amount, 1)" />
            <small>{{ goalProgress(goal) }}% concluído - {{ formatMoney(goal.monthly_contribution) }}/mês</small>
          </article>
        </div>
      </article>

      <article id="budget" class="panel" data-testid="planning-budget">
        <div class="section-title">
          <div>
            <p class="eyebrow">Orçamento</p>
            <h2>Categorias do mês</h2>
          </div>
          <WalletCards />
        </div>
        <form class="budget-form" @submit.prevent="saveBudget">
          <label>
            Categoria
            <select v-model="budgetForm.category" data-testid="budget-category">
              <option v-for="category in budgetCategories" :key="category" :value="category">{{ category }}</option>
            </select>
          </label>
          <label>
            Planejado
            <input v-model.number="budgetForm.planned" data-testid="budget-planned" type="number" min="0" step="0.01" required />
          </label>
          <button class="primary-button" data-testid="budget-submit" type="submit">Salvar orçamento</button>
        </form>
        <div class="budget-table" role="table">
          <div class="budget-row header" role="row">
            <span>Categoria</span><span>Planejado</span><span>Real</span><span>Risco</span>
          </div>
          <div v-for="row in visibleBudgets" :key="row.category" class="budget-row" role="row">
            <span>{{ row.category }}</span>
            <span>{{ formatMoney(row.planned) }}</span>
            <span>{{ formatMoney(row.actual) }}</span>
            <span :class="`budget-risk ${row.risk}`">{{ riskLabel(row.risk) }}</span>
          </div>
        </div>
      </article>
    </section>

    <section id="purchase-simulator" class="panel" data-testid="purchase-simulator">
      <div class="section-title">
        <div>
          <p class="eyebrow">Compras</p>
          <h2>Posso comprar?</h2>
        </div>
        <ShoppingBag />
      </div>
      <form class="simulator-grid" @submit.prevent="runSimulation">
        <label>
          Item
          <input v-model="simulatorForm.item_name" data-testid="sim-item" required />
        </label>
        <label>
          Valor
          <input v-model.number="simulatorForm.amount" data-testid="sim-amount" type="number" min="0.01" step="0.01" required />
        </label>
        <label>
          Pagamento
          <select v-model="simulatorForm.payment_type" data-testid="sim-payment">
            <option value="cash">A vista</option>
            <option value="credit">Cartão</option>
          </select>
        </label>
        <label>
          Parcelas
          <input v-model.number="simulatorForm.installments" data-testid="sim-installments" type="number" min="1" step="1" />
        </label>
        <label>
          Categoria
          <select v-model="simulatorForm.category" data-testid="sim-category">
            <option v-for="category in budgetCategories" :key="category" :value="category">{{ category }}</option>
          </select>
        </label>
        <button class="primary-button" data-testid="sim-submit" type="submit">Simular</button>
      </form>
      <article v-if="simulation" class="decision-card" :class="simulation.decision" data-testid="sim-result">
        <strong>{{ decisionLabel(simulation.decision) }}</strong>
        <p>Impacto mensal: {{ formatMoney(simulation.monthly_impact) }}. Nenhuma transação foi criada.</p>
        <ul>
          <li v-for="reason in simulation.reasons" :key="reason">{{ reason }}</li>
        </ul>
      </article>
    </section>

    <section id="wishlist" class="panel" data-testid="identity-wishlist">
      <div class="section-title">
        <div>
          <p class="eyebrow">Wishlist</p>
          <h2>Identidade de produto</h2>
        </div>
        <PackageCheck />
      </div>
      <form class="wishlist-form" @submit.prevent="reviewWishlistIdentity">
        <label>
          Produto para monitorar
          <input v-model="wishlistText" data-testid="wishlist-text" placeholder="lanterna tras ld punto" required />
        </label>
        <label>
          Preço alvo
          <input v-model.number="wishlistTarget" data-testid="wishlist-target" type="number" min="0" step="0.01" />
        </label>
        <button class="primary-button" data-testid="wishlist-review" type="submit">Revisar compatibilidade</button>
      </form>

      <article v-if="identityReview" class="identity-review" data-testid="identity-review">
        <strong>Detectei que você quer monitorar:</strong>
        <p>{{ describeProductIdentity(identityReview) }}</p>
        <small>Consulta segura: {{ buildProductSearchQuery(identityReview) }}</small>
        <div class="review-actions">
          <button class="primary-button" data-testid="identity-confirm" type="button" @click="confirmIdentity">Confirmar</button>
          <button class="secondary-button" type="button" @click="editIdentity">Editar detalhes</button>
          <button class="secondary-button" type="button" @click="saveFreeText">Monitorar como texto livre</button>
        </div>
        <p v-if="freeTextWarning" class="warning">Texto livre pode retornar item ambíguo e não exibirá melhor preço sem revisão.</p>
      </article>

      <div class="wishlist-list">
        <article v-for="item in wishlist" :key="item.id" class="wish-row" data-testid="wishlist-row">
          <div>
            <strong>{{ item.name }}</strong>
            <p>{{ identitySummary(item) }}</p>
            <small>Status: {{ priceStatusLabel(item.price_search_status) }} - score {{ item.last_match_score || 0 }}</small>
          </div>
          <div class="wish-actions">
            <button class="secondary-button" type="button" data-testid="mock-candidates" @click="mockCandidates(item)">
              Testar compatibilidade
            </button>
            <span v-if="canTriggerWishlistTargetAlert(item)" class="alert-ok">Alerta permitido</span>
            <span v-else class="alert-muted">Sem alerta duplicado/incompativel</span>
          </div>
        </article>
      </div>
    </section>

    <section class="panel narrative" data-testid="planning-narrative">
      <div class="section-title">
        <div>
          <p class="eyebrow">Relatorio</p>
          <h2>Narrativa do planejamento</h2>
        </div>
        <FileText />
      </div>
      <p v-for="paragraph in narrative.paragraphs" :key="paragraph">{{ paragraph }}</p>
    </section>
  </main>
</template>

<script setup>
import { computed, ref } from 'vue'
import {
  FileText,
  PackageCheck,
  ShoppingBag,
  Target,
  WalletCards,
} from 'lucide-vue-next'
import { useFinanceStore } from '@/stores/finance.js'
import {
  BUDGET_CATEGORIES,
  PLANNING_GOAL_TYPES,
  buildBudgetRows,
  buildMonthlyPlan,
  buildNarrativeReport,
  recommendInvestmentContribution,
  simulatePlannedPurchase,
} from '@/utils/planning-engine.js'
import {
  buildProductSearchQuery,
  canTriggerWishlistTargetAlert,
  chooseBestCompatibleOffer,
  describeProductIdentity,
  normalizeProductIdentity,
} from '@/utils/productIdentity.js'

const financeStore = useFinanceStore()
const goalTypes = PLANNING_GOAL_TYPES
const budgetCategories = BUDGET_CATEGORIES
const planningDate = computed(() => currentPlanningDate())

const goalForm = ref({
  name: '',
  type: 'reserva_emergencia',
  target_amount: 0,
  current_amount: 0,
  monthly_contribution: 0,
  target_date: '',
})
const budgetForm = ref({ category: 'Mercado', planned: 0 })
const simulatorForm = ref({
  item_name: '',
  amount: 0,
  payment_type: 'cash',
  installments: 1,
  category: 'Outros',
  purchase_date: planningIsoDate(),
})
const simulation = ref(null)
const wishlistText = ref('lanterna tras ld punto')
const wishlistTarget = ref(0)
const identityReview = ref(null)
const freeTextWarning = ref(false)

const goals = computed(() => financeStore.state.planningGoals || [])
const wishlist = computed(() => financeStore.state.wishlist || [])
const monthlyPlan = computed(() => buildMonthlyPlan(financeStore.state, planningDate.value))
const investment = computed(() => recommendInvestmentContribution(financeStore.state, planningDate.value))
const narrative = computed(() => buildNarrativeReport(financeStore.state, planningDate.value))
const visibleBudgets = computed(() => buildBudgetRows(financeStore.state, planningDate.value)
  .filter((row) => row.planned > 0 || row.actual > 0)
  .slice(0, 8))

function formatMoney(value) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value || 0))
}

function typeLabel(type) {
  return {
    reserva_emergencia: 'Reserva de emergência',
    compra_planejada: 'Compra planejada',
    quitar_divida: 'Quitar dívida',
    investimento_mensal: 'Investimento mensal',
    viagem: 'Viagem',
    entrada_bem: 'Entrada de bem',
    reduzir_categoria: 'Reduzir categoria',
  }[type] || type
}

function riskLabel(risk) {
  return {
    stable: 'estável',
    ok: 'sob controle',
    attention: 'atenção',
    overrun: 'risco de estouro',
    critical: 'crítico',
  }[risk] || risk
}

function decisionLabel(decision) {
  return {
    can_buy_now: 'Pode comprar agora',
    wait: 'Melhor esperar',
    only_if_adjust_budget: 'Somente ajustando orçamento',
    not_recommended: 'Não recomendado',
    goal_conflict: 'Conflita com meta',
    card_risk: 'Risco no cartão',
  }[decision] || decision
}

function goalProgress(goal) {
  if (!goal.target_amount) return 0
  return Math.min(100, Math.round((Number(goal.current_amount || 0) / Number(goal.target_amount)) * 100))
}

function addGoal() {
  financeStore.addPlanningGoal(goalForm.value)
  goalForm.value = {
    name: '',
    type: 'reserva_emergencia',
    target_amount: 0,
    current_amount: 0,
    monthly_contribution: 0,
    target_date: '',
  }
}

function saveBudget() {
  financeStore.upsertCategoryBudget({
    ...budgetForm.value,
    month_key: monthlyPlan.value.month_key,
  })
  budgetForm.value = { category: 'Mercado', planned: 0 }
}

function runSimulation() {
  simulation.value = simulatePlannedPurchase(simulatorForm.value, financeStore.state, planningDate.value)
}

function reviewWishlistIdentity() {
  identityReview.value = normalizeProductIdentity(wishlistText.value)
  freeTextWarning.value = false
}

function confirmIdentity() {
  const identity = identityReview.value
  if (!identity) return
  financeStore.addWishlistItem({
    name: wishlistText.value,
    value: null,
    category: 'Outros',
    priority: 'Media',
    targetPrice: wishlistTarget.value || null,
    product_identity: identity,
    price_search_status: 'quote_pending',
    last_match_score: 0,
    last_match_reason: 'Aguardando cotação compatível.',
    last_rejected_candidates: [],
  })
  identityReview.value = null
}

function editIdentity() {
  wishlistText.value = buildProductSearchQuery(identityReview.value)
}

function saveFreeText() {
  freeTextWarning.value = true
  financeStore.addWishlistItem({
    name: wishlistText.value,
    value: null,
    category: 'Outros',
    priority: 'Media',
    targetPrice: wishlistTarget.value || null,
    product_identity: null,
    price_search_status: 'found_ambiguous',
    last_match_score: 0,
    last_match_reason: 'Texto livre exige revisão manual.',
  })
  identityReview.value = null
}

function identitySummary(item) {
  return item.product_identity ? describeProductIdentity(item.product_identity) : 'Texto livre, sem preço compatível confirmado'
}

function priceStatusLabel(status) {
  return {
    quote_pending: 'cotação pendente',
    searching: 'buscando',
    found_compatible: 'compatível',
    found_ambiguous: 'ambíguo',
    not_found: 'não encontrado',
    error: 'erro',
  }[status] || status
}

function currentPlanningDate() {
  const now = new Date()
  const year = normalizeYear(financeStore.state.settings?.year)
  const month = normalizeMonth(financeStore.state.settings?.selectedMonth)
  const day = Math.min(now.getDate(), new Date(year, month, 0).getDate())
  return new Date(year, month - 1, day, 12)
}

function planningIsoDate() {
  const date = currentPlanningDate()
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function normalizeMonth(value) {
  const month = Number(value)
  return Number.isInteger(month) && month >= 1 && month <= 12 ? month : new Date().getMonth() + 1
}

function normalizeYear(value) {
  const year = Number(value)
  return Number.isInteger(year) && year >= 2000 ? year : new Date().getFullYear()
}

function mockCandidates(item) {
  const result = chooseBestCompatibleOffer([
    { title: 'Lanterna Traseira Siena Tampa Magneti Marelli', price: 110.25, total: 110.25 },
    { title: 'Lanterna Traseira Hilux 2012/2015 Direita', price: 252.68, total: 252.68 },
    { title: 'Lanterna Mala Direito Grand Siena', price: 209.61, total: 209.61 },
    { title: 'Magneti Marelli Lanterna Fiat Palio Weekend', price: 213.21, total: 213.21 },
    { title: 'Lanterna Fiat Palio Adventure', price: 229.77, total: 229.77 },
    { title: 'Lanterna Traseira Direita Fiat Punto 2008 2009', price: 320, total: 320 },
  ], item.product_identity)

  financeStore.updateWishlistItem(item.id, {
    value: result.best_compatible_offer?.total || null,
    lastQuotedPrice: result.best_compatible_offer?.total || 0,
    marketplaceOffers: result.accepted_candidates,
    price_search_status: result.status,
    last_match_score: result.score,
    last_match_reason: result.reason,
    best_compatible_offer: result.best_compatible_offer,
    accepted_candidates: result.accepted_candidates,
    ambiguous_candidates: result.ambiguous_candidates,
    last_rejected_candidates: result.rejected_candidates,
  })
}
</script>

<style scoped>
.planning-page {
  width: min(1180px, 100%);
  margin: 0 auto;
  padding: 1rem 1.25rem 2rem;
  display: grid;
  gap: 1rem;
  overflow-x: hidden;
}

.page-head,
.panel,
.summary-grid article,
.mini-card {
  background: var(--surface-ledger);
  border: 1px solid var(--divider);
  border-radius: var(--radius-sm);
  box-shadow: none;
}

.page-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 1rem;
}

.page-head h1 {
  margin: 0.12rem 0;
  font-family: var(--font-display);
  font-size: var(--page-title-size);
  font-weight: var(--page-title-weight);
  line-height: var(--page-title-line-height);
  letter-spacing: 0;
}

.section-title h2 {
  margin: 0.12rem 0;
}

.page-head p,
.mini-card span,
.mini-card small,
.budget-row,
.identity-review small,
.wish-row p,
.wish-row small {
  color: var(--text-secondary);
}

.page-head p:not(.eyebrow) {
  font-family: var(--font-sans);
  font-size: var(--page-subtitle-size);
  line-height: 1.5;
}

.eyebrow {
  margin: 0;
  color: var(--accent-hover);
  font-family: var(--font-sans);
  font-size: var(--text-xs);
  font-weight: 700;
  letter-spacing: var(--eyebrow-letter-spacing);
  text-transform: uppercase;
}

.risk-pill,
.budget-risk,
.alert-ok,
.alert-muted {
  border-radius: 999px;
  padding: 0.32rem 0.62rem;
  font-size: 0.76rem;
  font-weight: 800;
  white-space: nowrap;
}

.risk-pill.stable,
.budget-risk.ok,
.alert-ok {
  color: var(--income);
  background: var(--income-dim);
}

.risk-pill.attention,
.budget-risk.attention,
.budget-risk.overrun {
  color: var(--warning);
  background: var(--warning-dim);
}

.risk-pill.critical {
  color: var(--danger);
  background: var(--danger-dim);
}

.alert-muted {
  color: var(--text-secondary);
  background: var(--bg-hover);
}

.summary-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 190px), 1fr));
  gap: 0.75rem;
}

.summary-grid article {
  padding: 0.85rem;
  min-width: 0;
}

.summary-grid span {
  display: block;
  color: var(--text-secondary);
  font-size: 0.76rem;
}

.summary-grid strong {
  display: block;
  margin-top: 0.25rem;
  font-size: 1.08rem;
  overflow-wrap: anywhere;
}

.content-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: 1rem;
}

.panel {
  padding: 1rem;
  min-width: 0;
}

.section-title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 0.85rem;
}

.section-title svg {
  width: 22px;
  height: 22px;
  color: var(--accent-hover);
}

.form-grid,
.simulator-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0.7rem;
}

.budget-form,
.wishlist-form {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(120px, 0.35fr) auto;
  align-items: end;
  gap: 0.7rem;
}

label {
  display: grid;
  gap: 0.35rem;
  color: var(--text-primary);
  font-size: 0.84rem;
  min-width: 0;
}

input,
select {
  width: 100%;
  min-width: 0;
  min-height: 42px;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  background: var(--bg-input);
  color: var(--text-primary);
  padding: 0.62rem 0.72rem;
}

input:focus-visible,
select:focus-visible {
  outline: none;
  border-color: var(--input-border-focus);
  box-shadow: var(--focus-ring);
}

.goal-list,
.wishlist-list {
  display: grid;
  gap: 0.65rem;
  margin-top: 0.85rem;
}

.mini-card {
  display: grid;
  gap: 0.35rem;
  padding: 0.7rem;
  transition: border-color 0.16s ease, background 0.16s ease;
}

.mini-card:hover {
  border-color: color-mix(in srgb, var(--accent) 26%, var(--border-color));
  background: var(--surface-muted);
}

progress {
  height: 9px;
  width: 100%;
  overflow: hidden;
  border: 0;
  border-radius: 999px;
  background: var(--bg-elevated);
  appearance: none;
}

progress::-webkit-progress-bar {
  border-radius: inherit;
  background: var(--bg-elevated);
}

progress::-webkit-progress-value {
  border-radius: inherit;
  background: var(--gradient-accent);
}

progress::-moz-progress-bar {
  border-radius: inherit;
  background: var(--gradient-accent);
}

.budget-table {
  display: grid;
  gap: 0.35rem;
  margin-top: 0.85rem;
}

.budget-row {
  display: grid;
  grid-template-columns: 1.1fr 0.8fr 0.8fr 0.8fr;
  gap: 0.6rem;
  align-items: center;
  padding: 0.62rem 0.7rem;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  background: color-mix(in srgb, var(--bg-hover) 72%, var(--bg-panel));
  font-size: 0.86rem;
}

.budget-row.header {
  border-color: transparent;
  background: transparent;
  color: var(--text-primary);
  font-weight: 800;
}

.decision-card,
.identity-review,
.wish-row {
  margin-top: 0.85rem;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  background: color-mix(in srgb, var(--bg-hover) 74%, var(--bg-panel));
  padding: 0.85rem;
}

.decision-card.can_buy_now {
  border-color: rgba(22, 163, 74, 0.45);
}

.decision-card.not_recommended,
.decision-card.card_risk {
  border-color: rgba(220, 38, 38, 0.45);
}

.review-actions,
.wish-actions {
  display: flex;
  gap: 0.55rem;
  flex-wrap: wrap;
  align-items: center;
}

.warning {
  color: #d97706;
}

.wish-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
}

.narrative p {
  margin: 0.45rem 0;
  color: var(--text-secondary);
}

@media (max-width: 980px) {
  .summary-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .content-grid,
  .form-grid,
  .simulator-grid,
  .budget-form,
  .wishlist-form {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 520px) {
  .planning-page {
    padding: 0.75rem;
  }

  .page-head,
  .wish-row {
    display: grid;
    align-items: start;
  }

  .summary-grid {
    grid-template-columns: 1fr;
  }

  .budget-row {
    grid-template-columns: 1fr 1fr;
  }

  .review-actions,
  .wish-actions {
    display: grid;
  }
}
</style>
