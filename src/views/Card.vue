<template>
  <div class="operation-shell card-view" data-testid="card-operation-page">
    <section class="operation-hero" data-testid="operation-hero">
      <div>
        <p class="eyebrow">Operação de cartão</p>
        <h1>Fatura do cartão</h1>
        <p>Controle limite, fatura por competência e pagamento em uma tela operacional única.</p>
      </div>
      <div class="operation-hero-actions">
        <router-link to="/entries" class="primary-button link-button">
          <Plus :size="16" />
          <span>Registrar despesa</span>
        </router-link>
        <FinanceManageLink tab="cards" label="Gerenciar cartões" />
      </div>
    </section>

    <section v-if="!hasCards" class="panel operation-empty-panel">
      <div>
        <p class="eyebrow">Primeiro cartão</p>
        <h2>Nenhum cartão cadastrado</h2>
        <p>Crie um cartão no cadastro financeiro para acompanhar fatura, limite, fechamento e vencimento por cartão.</p>
      </div>
      <router-link to="/structure?tab=cards" class="primary-button link-button">Cadastrar cartão</router-link>
    </section>

    <div v-else class="operation-layout">
      <main class="operation-main">
        <section class="panel operation-panel">
          <div class="panel-head">
            <div>
              <p class="eyebrow">Competência {{ monthLabel }}</p>
              <h2>{{ activeCard?.name || 'Cartão' }}</h2>
              <p class="subtitle">Limites e cadastro estrutural continuam em Finanças -> Cadastro.</p>
            </div>
            <label v-if="cards.length > 1" class="card-picker">
              Cartão
              <select v-model="selectedCardId">
                <option v-for="c in cards" :key="c.id" :value="c.id">{{ c.name }}</option>
              </select>
            </label>
          </div>

          <div class="operation-metric-rail card-summary">
            <div class="summary-item">
              <span class="label">Limite</span>
              <span class="value">{{ formatCurrency(cardLimit) }}</span>
            </div>
            <div class="summary-item">
              <span class="label">Fatura</span>
              <span class="value" :class="{ expense: currentBill > 0, neutral: currentBill === 0 }">
                {{ formatCurrency(currentBill) }}
              </span>
            </div>
            <div class="summary-item">
              <span class="label">Disponível</span>
              <span class="value" :class="{ positive: available >= 0, negative: available < 0 }">
                {{ formatCurrency(available) }}
              </span>
            </div>
            <div class="summary-item metric-progress">
              <span class="label">Uso do limite</span>
              <span class="value subtle">{{ limitUsagePercent }}%</span>
              <div class="meter"><span :style="{ width: `${limitUsagePercent}%` }" /></div>
            </div>
          </div>

          <div v-if="useLegacySettings" class="legacy-note panel-inset">
            <p>
              Controle básico ativo com as configurações gerais.
              Cadastre um cartão para desbloquear limite e fatura por cartão.
            </p>
            <form @submit.prevent="saveCardSettings" class="card-settings-form">
              <div class="form-row">
                <label>
                  Limite
                  <input v-model.number="localSettings.cardLimit" type="number" step="0.01" min="0" />
                </label>
                <label>
                  Fechamento
                  <input v-model.number="localSettings.cardClosingDay" type="number" min="1" max="31" />
                </label>
                <label>
                  Vencimento
                  <input v-model.number="localSettings.cardDueDay" type="number" min="1" max="31" />
                </label>
              </div>
              <button type="submit" class="save-button">
                <Save />
                <span>Salvar configuração inicial</span>
              </button>
            </form>
          </div>

          <div class="card-expenses">
            <div class="list-head">
              <div>
                <h3>Despesas no cartão</h3>
                <p>{{ cardExpenses.length }} lançamento{{ cardExpenses.length === 1 ? '' : 's' }} em {{ monthLabel }}</p>
              </div>
              <span class="status-chip">{{ billStatusLabel }}</span>
            </div>

            <div v-if="cardExpenses.length === 0" class="empty-state">
              <p>Nenhuma despesa neste cartão no período.</p>
              <router-link to="/entries" class="secondary-button link-button">Registrar despesa</router-link>
            </div>
            <div v-for="expense in cardExpenses" :key="expense.id" class="expense-item">
              <div class="expense-info">
                <span class="expense-description">{{ expense.description }}</span>
                <span class="expense-category">{{ expense.category }}</span>
              </div>
              <div class="expense-amount">
                <span>{{ formatCurrency(expense.amount) }}</span>
                <span class="expense-date">{{ formatDate(expense.date) }}</span>
              </div>
              <button class="icon-button" type="button" @click="markAsPaid(expense.id)" title="Marcar como pago">
                <Check v-if="expense.paid" />
                <Circle v-else />
              </button>
            </div>
          </div>
        </section>
      </main>

      <aside class="operation-side-panel">
        <section class="panel side-card">
          <p class="eyebrow">Próximo marco</p>
          <h2>{{ nextCardMilestone }}</h2>
          <p>Use essa data para decidir se vale antecipar ou adiar compras antes do fechamento.</p>
        </section>
        <section class="panel side-card">
          <p class="eyebrow">Ação operacional</p>
          <h2>{{ billStatusLabel }}</h2>
          <p>{{ cardActionHint }}</p>
          <button class="primary-button" type="button" @click="payBill" :disabled="currentBill <= 0">
            <CreditCard />
            <span>Fechar e pagar fatura</span>
          </button>
        </section>
      </aside>
    </div>

    <ConfirmModal
      :show="showConfirmModal"
      title="Confirmar pagamento"
      :message="confirmMessage"
      @confirm="handleConfirmPay"
      @cancel="showConfirmModal = false"
    />
  </div>
</template>

<script setup>
import { computed, ref, onMounted, watch } from 'vue'
import { useFinanceStore } from '@/stores/finance'
import { useNotification } from '@/composables/useNotification'
import { SOURCE_TYPES } from '@/constants/financial-structure.js'
import ConfirmModal from '@/components/ConfirmModal.vue'
import FinanceManageLink from '@/components/FinanceManageLink.vue'
import { CreditCard, Check, Circle, Save, Plus } from 'lucide-vue-next'

const financeStore = useFinanceStore()
const { showToast } = useNotification()

const selectedCardId = ref(null)
const localSettings = ref({ cardLimit: 0, cardClosingDay: 1, cardDueDay: 10 })
const showConfirmModal = ref(false)
const confirmMessage = ref('')

const cards = computed(() => financeStore.state.creditCards || [])
const hasCards = computed(() => cards.value.length > 0)
const useLegacySettings = computed(() => !hasCards.value)

const activeCard = computed(() => {
  const id = selectedCardId.value || cards.value[0]?.id
  return cards.value.find((c) => c.id === id) || null
})

watch(cards, (list) => {
  if (list.length && !selectedCardId.value) selectedCardId.value = list[0].id
}, { immediate: true })

const cardLimit = computed(() => {
  if (activeCard.value) return Number(activeCard.value.limit || 0)
  return Number(financeStore.state.settings.cardLimit || 0)
})

const monthKey = computed(() => financeStore.selectedKey)

const cardExpenses = computed(() => {
  const card = activeCard.value
  return financeStore.state.expenses
    .filter((exp) => {
      if (exp.payment !== 'Crédito') return false
      if (financeStore.expenseImpactKey(exp) !== monthKey.value) return false
      if (!card) return true
      const cardId = exp.creditCardId || (exp.sourceType === SOURCE_TYPES.CREDIT_CARD ? exp.sourceId : null)
      return !cardId || cardId === card.id
    })
    .sort((a, b) => new Date(b.date) - new Date(a.date))
})

const currentBill = computed(() =>
  cardExpenses.value.reduce((sum, exp) => sum + Number(exp.amount || 0), 0),
)

const available = computed(() => {
  if (activeCard.value?.availableLimit != null) return Number(activeCard.value.availableLimit)
  return cardLimit.value - currentBill.value
})

const limitUsagePercent = computed(() => {
  if (cardLimit.value <= 0) return 0
  return Math.min(100, Math.max(0, Math.round((currentBill.value / cardLimit.value) * 100)))
})

const billStatusLabel = computed(() => {
  if (currentBill.value <= 0) return 'Sem fatura aberta'
  if (available.value < 0) return 'Limite excedido'
  if (limitUsagePercent.value >= 80) return 'Atenção ao limite'
  return 'Fatura sob controle'
})

const nextCardMilestone = computed(() => {
  if (!activeCard.value) return 'Cadastre um cartão'
  return `Fecha dia ${activeCard.value.closingDay} e vence dia ${activeCard.value.dueDay}`
})

const cardActionHint = computed(() => {
  if (currentBill.value <= 0) return 'Registre despesas no cartão para acompanhar competência, limite e pagamento.'
  if (available.value < 0) return 'Revise compras recentes e quite a fatura para recompor limite operacional.'
  return 'Quando a fatura for paga, confirme aqui para manter fluxo e saldos consistentes.'
})

const monthLabel = computed(() => {
  const m = financeStore.state.settings.selectedMonth
  const y = financeStore.state.settings.year
  return `${financeStore.monthNames[m - 1]}/${y}`
})

function formatCurrency(value) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0)
}

function formatDate(date) {
  return new Date(date).toLocaleDateString('pt-BR')
}

function saveCardSettings() {
  financeStore.updateSettings({
    cardLimit: localSettings.value.cardLimit,
    cardClosingDay: localSettings.value.cardClosingDay,
    cardDueDay: localSettings.value.cardDueDay,
  })
  showToast('Configuração inicial atualizada', 'success')
}

function markAsPaid(id) {
  const expense = financeStore.state.expenses.find((e) => e.id === id)
  if (expense) {
    expense.paid = !expense.paid
    financeStore.saveState()
  }
}

function payBill() {
  if (currentBill.value <= 0) {
    showToast('Não há fatura para pagar neste período.', 'warning')
    return
  }
  confirmMessage.value = `Pagar fatura de ${formatCurrency(currentBill.value)}${activeCard.value ? ` (${activeCard.value.name})` : ''}?`
  showConfirmModal.value = true
}

function handleConfirmPay() {
  showConfirmModal.value = false
  const cardLabel = activeCard.value?.name || 'cartão'

  financeStore.addExpense({
    date: new Date().toISOString().split('T')[0],
    category: 'Outros',
    description: `Pagamento fatura - ${cardLabel}`,
    payment: 'Dinheiro',
    amount: currentBill.value,
    paid: true,
  })

  cardExpenses.value.forEach((exp) => {
    const row = financeStore.state.expenses.find((e) => e.id === exp.id)
    if (row) row.paid = true
  })

  financeStore.saveState()
  showToast('Fatura paga com sucesso!', 'success')
}

onMounted(() => {
  localSettings.value = {
    cardLimit: financeStore.state.settings.cardLimit,
    cardClosingDay: financeStore.state.settings.cardClosingDay,
    cardDueDay: financeStore.state.settings.cardDueDay,
  }
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
.operation-hero p,
.operation-empty-panel h2,
.operation-empty-panel p {
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

.operation-empty-panel {
  min-height: 280px;
  display: grid;
  place-items: center;
  justify-items: center;
  gap: 1rem;
  text-align: center;
}

.panel {
  background: var(--surface-ledger);
  border: 1px solid var(--divider);
  border-radius: var(--radius-sm);
  padding: 1.5rem;
  box-shadow: none;
}

.subtitle {
  margin: 0.25rem 0 0;
  font-size: 0.84rem;
  color: var(--text-secondary);
}

.link-button {
  display: inline-flex;
  text-decoration: none;
}

.panel-head {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  align-items: flex-start;
  gap: 1rem;
  margin-bottom: 1.5rem;
}

.panel-head h2 {
  margin: 0;
  font-size: 1.25rem;
  font-weight: 700;
  color: var(--text-primary);
}

.card-picker {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  font-size: 0.75rem;
  font-weight: 700;
  color: var(--text-secondary);
}

.card-picker select {
  min-width: 180px;
  padding: 0.55rem 0.75rem;
  border-radius: 8px;
  border: 1px solid var(--border-color);
  background: var(--bg-input);
  color: var(--text-primary);
}

.operation-metric-rail {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
  gap: 1rem;
  margin-bottom: 1.5rem;
}

.summary-item {
  display: grid;
  gap: 0.35rem;
  padding: 1rem;
  background: var(--bg-elevated);
  border-radius: 8px;
  border: 1px solid var(--border-color);
}

.summary-item .label {
  display: block;
  font-size: 0.75rem;
  color: var(--text-secondary);
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: var(--eyebrow-letter-spacing);
}

.summary-item .value {
  font-size: 1.125rem;
  font-weight: 800;
  color: var(--text-primary);
}

.summary-item .value.expense,
.summary-item .value.negative {
  color: #ef4444;
}

.summary-item .value.positive {
  color: #10b981;
}

.summary-item .value.neutral,
.summary-item .value.subtle {
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

.card-settings-form .form-row {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  gap: 1rem;
}

.card-settings-form label {
  display: grid;
  gap: 0.35rem;
  color: var(--text-secondary);
  font-size: 0.82rem;
  font-weight: 700;
}

.card-settings-form input {
  min-height: 40px;
  padding: 0.55rem 0.7rem;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  background: var(--bg-input);
  color: var(--text-primary);
}

.card-expenses h3 {
  margin: 0;
  font-size: 1rem;
  color: var(--text-primary);
}

.list-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 0.75rem;
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

.expense-item {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 0.75rem 0;
  border-bottom: 1px solid var(--border-color);
}

.expense-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
}

.expense-description {
  font-weight: 700;
  color: var(--text-primary);
  overflow-wrap: anywhere;
}

.expense-category,
.expense-date {
  font-size: 0.75rem;
  color: var(--text-secondary);
}

.expense-amount {
  text-align: right;
  display: flex;
  flex-direction: column;
  color: var(--text-primary);
  font-weight: 800;
}

.empty-state {
  display: grid;
  justify-items: center;
  gap: 0.65rem;
  text-align: center;
  padding: 2rem;
  color: var(--text-secondary);
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

.save-button,
.primary-button,
.secondary-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
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
