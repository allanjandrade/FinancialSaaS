<template>
  <div class="operation-shell benefit-view" data-testid="benefit-operation-page">
    <section class="operation-hero" data-testid="operation-hero">
      <div>
        <p class="eyebrow">Operação de benefícios</p>
        <h1>Uso de benefícios</h1>
        <p>Acompanhe VA, VR, recargas, consumo do mês e saldo projetado sem misturar carteira com conta bancária.</p>
      </div>
      <div class="operation-hero-actions">
        <router-link to="/entries" class="primary-button link-button">
          <Receipt :size="16" />
          <span>Registrar consumo</span>
        </router-link>
        <FinanceManageLink tab="benefits" label="Gerenciar benefícios" />
      </div>
    </section>

    <div class="operation-layout">
      <main class="operation-main">
        <section class="panel operation-panel">
          <div class="panel-head">
            <div>
              <p class="eyebrow">Competência {{ monthLabel }}</p>
              <h2>{{ kindTitle }}</h2>
              <p class="subtitle">Saldos e recargas são cadastrados em Finanças -> Benefícios.</p>
            </div>
            <div class="head-controls">
              <div class="kind-tabs">
                <button
                  type="button"
                  :class="{ active: benefitKind === 'va' }"
                  @click="benefitKind = 'va'"
                >
                  VA
                </button>
                <button
                  type="button"
                  :class="{ active: benefitKind === 'vr' }"
                  @click="benefitKind = 'vr'"
                >
                  VR
                </button>
              </div>
              <label v-if="walletsForKind.length > 1" class="wallet-picker">
                Carteira
                <select v-model="selectedWalletId">
                  <option v-for="w in walletsForKind" :key="w.id" :value="w.id">{{ w.name }}</option>
                </select>
              </label>
            </div>
          </div>

          <div v-if="!walletsForKind.length && !useLegacyMode" class="empty-state">
            <p>Nenhuma carteira {{ benefitKind === 'va' ? 'VA' : 'VR' }} cadastrada.</p>
            <router-link to="/structure?tab=benefits" class="primary-button link-button">
              Cadastrar benefício
            </router-link>
          </div>

          <template v-else>
            <div class="operation-metric-rail benefit-summary">
              <div class="summary-card">
                <span class="label">Saldo cadastrado</span>
                <span class="value">{{ formatCurrency(walletBalance) }}</span>
              </div>
              <div class="summary-card">
                <span class="label">Recarga no mês</span>
                <span class="value income">{{ formatCurrency(monthlyIncome) }}</span>
              </div>
              <div class="summary-card">
                <span class="label">Utilizado no mês</span>
                <span class="value" :class="{ expense: monthlyUse > 0, neutral: monthlyUse === 0 }">
                  {{ formatCurrency(monthlyUse) }}
                </span>
              </div>
              <div class="summary-card metric-progress">
                <span class="label">Eficiência de uso</span>
                <span class="value" :class="{ positive: projectedBalance >= 0, negative: projectedBalance < 0 }">
                  {{ benefitEfficiencyPercent }}%
                </span>
                <div class="meter"><span :style="{ width: `${benefitEfficiencyPercent}%` }" /></div>
              </div>
            </div>

            <div v-if="useLegacyMode" class="legacy-note panel-inset">
              <p>Controle básico ativo. Cadastre uma carteira VA/VR para acompanhar saldos separadamente.</p>
              <form @submit.prevent="saveBenefitSettings" class="benefit-settings-form">
                <label>
                  Saldo inicial VA
                  <input v-model.number="localSettings.vaInitialBalance" type="number" step="0.01" min="0" />
                </label>
                <button type="submit" class="save-button">
                  <Save />
                  <span>Salvar saldo inicial</span>
                </button>
              </form>
            </div>

            <div class="benefit-grid">
              <div class="list-head">
                <div>
                  <h3>Transações</h3>
                  <p>{{ transactions.length }} movimentação{{ transactions.length === 1 ? '' : 'ões' }} em {{ kindTitle }}</p>
                </div>
                <span class="status-chip">{{ benefitStatusLabel }}</span>
              </div>
              <EmptyState
                v-if="transactions.length === 0"
                class="inline"
                :icon="Receipt"
                title="Nenhuma transação neste período"
                description="Os consumos e recargas desta carteira aparecerão aqui assim que forem registrados."
                action-label="Registrar lançamento"
                action-to="/entries"
              />
              <div v-for="transaction in transactions" :key="transaction.id + transaction.type" class="transaction-item">
                <div class="transaction-icon" :class="transaction.type">
                  <component :is="transaction.type === 'expense' ? TrendingDown : TrendingUp" />
                </div>
                <div class="transaction-info">
                  <span class="transaction-description">{{ transaction.description }}</span>
                  <span class="transaction-category">{{ transaction.category || transaction.type }}</span>
                </div>
                <span class="transaction-amount" :class="transaction.type">
                  {{ transaction.type === 'expense' ? '-' : '+' }} {{ formatCurrency(transaction.amount) }}
                </span>
              </div>
            </div>
          </template>
        </section>
      </main>

      <aside class="operation-side-panel">
        <section class="panel side-card">
          <p class="eyebrow">Saldo projetado</p>
          <h2>{{ formatCurrency(projectedBalance) }}</h2>
          <p>{{ benefitActionHint }}</p>
        </section>
        <section class="panel side-card">
          <p class="eyebrow">Rotina sugerida</p>
          <h2>{{ benefitStatusLabel }}</h2>
          <p>Registre consumos no momento da compra para preservar a leitura real do saldo mensal.</p>
          <router-link to="/entries" class="secondary-button link-button">Registrar consumo</router-link>
        </section>
      </aside>
    </div>
  </div>
</template>

<script setup>
import { computed, ref, onMounted, watch } from 'vue'
import { useFinanceStore } from '@/stores/finance'
import { useNotification } from '@/composables/useNotification'
import { SOURCE_TYPES } from '@/constants/financial-structure.js'
import FinanceManageLink from '@/components/FinanceManageLink.vue'
import EmptyState from '@/components/EmptyState.vue'
import { TrendingUp, TrendingDown, Save, Receipt } from 'lucide-vue-next'

const financeStore = useFinanceStore()
const { showToast } = useNotification()

const benefitKind = ref('va')
const selectedWalletId = ref(null)
const localSettings = ref({ vaInitialBalance: 0 })

const allWallets = computed(() => financeStore.state.benefitWallets || [])
const walletsForKind = computed(() => allWallets.value.filter((w) => w.kind === benefitKind.value))

const activeWallet = computed(() => {
  const id = selectedWalletId.value || walletsForKind.value[0]?.id
  return walletsForKind.value.find((w) => w.id === id) || null
})

const useLegacyMode = computed(() => walletsForKind.value.length === 0)

watch([walletsForKind, benefitKind], () => {
  const wallets = walletsForKind.value
  if (wallets.length) selectedWalletId.value = wallets[0].id
  else selectedWalletId.value = null
})

const currentMonth = computed(() => financeStore.state.settings.selectedMonth)
const monthKey = computed(() => financeStore.selectedKey)

const monthLabel = computed(() => {
  const m = currentMonth.value
  const y = financeStore.state.settings.year
  return `${financeStore.monthNames[m - 1]}/${y}`
})

const kindTitle = computed(() => (benefitKind.value === 'va' ? 'Vale Alimentação' : 'Vale Refeição'))

const paymentFilter = computed(() => (benefitKind.value === 'va' ? 'VA' : 'VR'))
const incomeTypeFilter = computed(() => (benefitKind.value === 'va' ? 'VA' : 'VR'))
const sourceTypeFilter = computed(() =>
  benefitKind.value === 'va' ? SOURCE_TYPES.BENEFIT_VA : SOURCE_TYPES.BENEFIT_VR,
)

function matchesWallet(row) {
  if (!activeWallet.value) return true
  if (row.sourceId && row.sourceType === sourceTypeFilter.value) return row.sourceId === activeWallet.value.id
  return row.payment === paymentFilter.value || row.type === incomeTypeFilter.value
}

function rowInSelectedMonth(dateString) {
  const [y, m] = dateString.split('-').map(Number)
  return y * 100 + m === monthKey.value
}

const monthlyIncome = computed(() => {
  if (useLegacyMode.value) {
    if (benefitKind.value === 'va') return financeStore.calcMonth(currentMonth.value).vaIncome
    return financeStore.state.incomes
      .filter((inc) => inc.type === 'VR' && rowInSelectedMonth(inc.date))
      .reduce((s, i) => s + Number(i.amount || 0), 0)
  }
  return financeStore.state.incomes
    .filter((inc) => {
      if (inc.type !== incomeTypeFilter.value) return false
      return rowInSelectedMonth(inc.date) && matchesWallet(inc)
    })
    .reduce((s, i) => s + Number(i.amount || 0), 0)
})

const monthlyUse = computed(() => {
  if (useLegacyMode.value) {
    if (benefitKind.value === 'va') return financeStore.calcMonth(currentMonth.value).vaUse
    return financeStore.state.expenses
      .filter((exp) => exp.payment === 'VR' && financeStore.expenseImpactKey(exp) === monthKey.value)
      .reduce((s, e) => s + Number(e.amount || 0), 0)
  }
  return financeStore.state.expenses
    .filter((exp) => {
      if (exp.payment !== paymentFilter.value) return false
      return financeStore.expenseImpactKey(exp) === monthKey.value && matchesWallet(exp)
    })
    .reduce((s, e) => s + Number(e.amount || 0), 0)
})

const walletBalance = computed(() => {
  if (activeWallet.value) return Number(activeWallet.value.balance || 0)
  if (useLegacyMode.value && benefitKind.value === 'va') return Number(financeStore.state.settings.vaInitialBalance || 0)
  return 0
})

const projectedBalance = computed(() => walletBalance.value + monthlyIncome.value - monthlyUse.value)

const benefitEfficiencyPercent = computed(() => {
  const base = walletBalance.value + monthlyIncome.value
  if (base <= 0) return 0
  return Math.min(100, Math.max(0, Math.round((monthlyUse.value / base) * 100)))
})

const benefitStatusLabel = computed(() => {
  if (projectedBalance.value < 0) return 'Saldo em risco'
  if (monthlyUse.value <= 0) return 'Sem consumo no mês'
  if (benefitEfficiencyPercent.value >= 85) return 'Uso elevado'
  return 'Uso sob controle'
})

const benefitActionHint = computed(() => {
  if (projectedBalance.value < 0) return 'Revise lançamentos em VA/VR e confirme se o saldo cadastrado está atualizado.'
  if (monthlyUse.value <= 0) return 'Registre o primeiro consumo para acompanhar a evolução real do benefício.'
  return 'Saldo projetado preservado. Continue registrando consumos para manter o painel confiável.'
})

const transactions = computed(() => {
  const payment = paymentFilter.value
  const incomeType = incomeTypeFilter.value

  const expenses = financeStore.state.expenses
    .filter((exp) => {
      if (exp.payment !== payment) return false
      if (financeStore.expenseImpactKey(exp) !== monthKey.value) return false
      return matchesWallet(exp)
    })
    .map((exp) => ({ ...exp, type: 'expense' }))

  const incomes = financeStore.state.incomes
    .filter((inc) => {
      if (inc.type !== incomeType) return false
      const [y, m] = inc.date.split('-').map(Number)
      return y * 100 + m === monthKey.value && matchesWallet(inc)
    })
    .map((inc) => ({ ...inc, type: 'income' }))

  return [...expenses, ...incomes].sort((a, b) => new Date(b.date) - new Date(a.date))
})

function formatCurrency(value) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0)
}

function saveBenefitSettings() {
  financeStore.updateSettings({ vaInitialBalance: localSettings.value.vaInitialBalance })
  showToast('Saldo inicial atualizado', 'success')
}

onMounted(() => {
  localSettings.value.vaInitialBalance = financeStore.state.settings.vaInitialBalance
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

.operation-hero {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 1rem;
  padding-bottom: 1rem;
  border-bottom: 1px solid var(--border-color);
}

.operation-hero h1,
.operation-hero p {
  margin: 0;
}

.operation-hero h1 {
  color: var(--text-primary);
  font-family: var(--font-display);
  font-size: var(--page-title-size);
  font-weight: var(--page-title-weight);
  line-height: var(--page-title-line-height);
}

.operation-hero > div > p:not(.eyebrow) {
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

.operation-hero-actions :deep(.finance-manage-link) {
  margin: 0;
}

.operation-layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(280px, 0.34fr);
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
  padding: 1.5rem;
  box-shadow: none;
}

.panel-head {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 1.5rem;
}

.panel-head h2 {
  margin: 0;
  font-size: 1.25rem;
  font-weight: 700;
  color: var(--text-primary);
}

.subtitle {
  margin: 0.25rem 0 0;
  font-size: 0.84rem;
  color: var(--text-secondary);
}

.head-controls {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
  align-items: flex-end;
}

.kind-tabs {
  display: flex;
  border: 1px solid var(--border-color);
  border-radius: 999px;
  overflow: hidden;
  background: var(--bg-elevated);
}

.kind-tabs button {
  min-height: 38px;
  padding: 0.4rem 1rem;
  border: none;
  background: transparent;
  color: var(--text-secondary);
  font-size: 0.8125rem;
  font-weight: 800;
  cursor: pointer;
}

.kind-tabs button.active {
  background: var(--accent);
  color: #fff;
}

.wallet-picker {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  font-size: 0.75rem;
  font-weight: 700;
  color: var(--text-secondary);
}

.wallet-picker select {
  min-width: 160px;
  padding: 0.55rem 0.75rem;
  border-radius: 8px;
  border: 1px solid var(--border-color);
  background: var(--bg-input);
  color: var(--text-primary);
}

.operation-metric-rail {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 1rem;
  margin-bottom: 1.5rem;
}

.summary-card {
  display: grid;
  gap: 0.35rem;
  padding: 1rem;
  background: var(--bg-elevated);
  border-radius: 8px;
  border: 1px solid var(--border-color);
}

.summary-card .label {
  display: block;
  font-size: 0.75rem;
  color: var(--text-secondary);
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: var(--eyebrow-letter-spacing);
}

.summary-card .value {
  font-size: 1.125rem;
  font-weight: 800;
  color: var(--text-primary);
}

.summary-card .value.income,
.summary-card .value.positive {
  color: #10b981;
}

.summary-card .value.expense,
.summary-card .value.negative {
  color: #ef4444;
}

.summary-card .value.neutral {
  color: var(--text-primary);
}

.meter {
  height: 8px;
  overflow: hidden;
  border-radius: 999px;
  background: var(--bg-hover);
}

.meter span {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: var(--accent);
}

.legacy-note {
  margin-bottom: 1.5rem;
}

.panel-inset {
  padding: 1rem;
  border-radius: 8px;
  background: var(--bg-hover);
  border: 1px dashed var(--border-color);
}

.panel-inset p {
  font-size: 0.8125rem;
  color: var(--text-secondary);
  margin: 0 0 0.75rem;
}

.benefit-settings-form {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
  align-items: end;
}

.benefit-settings-form label {
  display: grid;
  gap: 0.35rem;
  color: var(--text-secondary);
  font-size: 0.82rem;
  font-weight: 700;
}

.benefit-settings-form input {
  min-height: 40px;
  padding: 0.55rem 0.7rem;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  background: var(--bg-input);
  color: var(--text-primary);
}

.list-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 0.75rem;
}

.benefit-grid h3 {
  margin: 0;
  font-size: 1rem;
  color: var(--text-primary);
}

.list-head p {
  margin: 0.2rem 0 0;
  color: var(--text-secondary);
  font-size: 0.84rem;
}

.status-chip {
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

.transaction-item {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 0.75rem 0;
  border-bottom: 1px solid var(--border-color);
}

.transaction-icon {
  width: 36px;
  height: 36px;
  border-radius: 999px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.transaction-icon.expense {
  background: rgba(239, 68, 68, 0.12);
  color: #ef4444;
}

.transaction-icon.income {
  background: rgba(16, 185, 129, 0.12);
  color: #10b981;
}

.transaction-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
}

.transaction-description {
  font-weight: 700;
  color: var(--text-primary);
  overflow-wrap: anywhere;
}

.transaction-category {
  font-size: 0.75rem;
  color: var(--text-secondary);
}

.transaction-amount {
  font-weight: 800;
  white-space: nowrap;
}

.transaction-amount.expense {
  color: #ef4444;
}

.transaction-amount.income {
  color: #10b981;
}

.empty-state {
  display: grid;
  justify-items: center;
  gap: 0.65rem;
  text-align: center;
  padding: 2rem;
  color: var(--text-secondary);
}

.empty-state.inline {
  padding: 1rem;
}

.side-card {
  display: grid;
  gap: 0.65rem;
}

.side-card h2,
.side-card p {
  margin: 0;
}

.side-card h2 {
  color: var(--text-primary);
  font-size: 1.02rem;
}

.side-card p {
  color: var(--text-secondary);
  line-height: 1.45;
}

.link-button,
.save-button,
.primary-button,
.secondary-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  text-decoration: none;
}

@media (max-width: 980px) {
  .operation-hero {
    align-items: flex-start;
    flex-direction: column;
  }

  .operation-layout {
    grid-template-columns: minmax(0, 1fr);
  }

  .operation-hero-actions,
  .operation-hero-actions .primary-button,
  .operation-hero-actions :deep(.finance-manage-link) {
    width: 100%;
  }
}
</style>
