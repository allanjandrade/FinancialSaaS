<template>
  <PageShell
    eyebrow="Planejamento"
    title="Orçamento mensal"
    description="Compare planejado, realizado e risco de estouro por categoria."
    testid="budget-page"
  >
    <template #actions>
      <button class="primary-button" type="button" @click="focusForm">Criar orçamento</button>
    </template>

    <section class="panel">
      <form ref="formRef" class="budget-form" @submit.prevent="saveBudget">
        <label>
          Categoria
          <select v-model="form.category" data-testid="budget-category">
            <option v-for="category in categories" :key="category" :value="category">{{ categoryLabel(category) }}</option>
          </select>
          <small class="field-hint" data-testid="budget-category-helper">
            Consultor preditivo: sugestões baseadas em padrões comuns. Você pode personalizar depois.
          </small>
        </label>
        <label>
          Planejado
          <input v-model.number="form.planned" data-testid="budget-planned" type="number" min="0" step="0.01" required />
        </label>
        <button class="primary-button" data-testid="budget-submit" type="submit">Criar orçamento</button>
      </form>
    </section>

    <EmptyState
      v-if="!visibleRows.length"
      :icon="WalletCards"
      title="Nenhum orçamento definido"
      description="Defina um limite por categoria para comparar planejado, realizado e risco."
      action-label="Criar orçamento"
      @action="focusForm"
    />

    <section v-else class="budget-table" data-testid="budget-table">
      <div class="budget-row header">
        <span>Categoria</span>
        <span>Planejado</span>
        <span>Realizado</span>
        <span>Restante</span>
        <span>Risco</span>
      </div>
      <div v-for="row in visibleRows" :key="row.category" class="budget-row">
        <span>{{ categoryLabel(row.category) }}</span>
        <span>{{ formatMoney(row.planned) }}</span>
        <span>{{ formatMoney(row.actual) }}</span>
        <span>{{ formatMoney(row.remaining) }}</span>
        <span class="risk" :class="row.risk">{{ riskLabel(row.risk) }}</span>
      </div>
    </section>
  </PageShell>
</template>

<script setup>
import { computed, ref } from 'vue'
import { WalletCards } from 'lucide-vue-next'
import EmptyState from '@/components/EmptyState.vue'
import PageShell from '@/components/layout/PageShell.vue'
import { useFinanceStore } from '@/stores/finance.js'
import { BUDGET_CATEGORIES, buildBudgetRows } from '@/utils/planning-engine.js'

const financeStore = useFinanceStore()
const PREDICTIVE_BUDGET_CATEGORY_SUGGESTIONS = Object.freeze(['Mercado', 'Moradia', 'Transporte', 'Saude', 'Assinaturas', 'Lazer'])
const CATEGORY_LABELS = Object.freeze({
  Acougue: 'Açougue',
  Saude: 'Saúde',
  Educacao: 'Educação',
  Cartao: 'Cartão',
})
const formRef = ref(null)
const form = ref({ category: 'Mercado', planned: 0 })
const monthKey = computed(() => financeStore.state.settings.year * 100 + financeStore.state.settings.selectedMonth)
const budgetReferenceDate = computed(() => currentBudgetDate())
const categories = computed(() => {
  const userCategories = [
    ...financeStore.state.categoryBudgets.map((budget) => budget.category),
    ...financeStore.state.expenses.map((expense) => expense.category),
  ].filter((category) => BUDGET_CATEGORIES.includes(category))

  return [...new Set([...PREDICTIVE_BUDGET_CATEGORY_SUGGESTIONS, ...userCategories])]
})
const visibleRows = computed(() => buildBudgetRows(financeStore.state, budgetReferenceDate.value)
  .filter((row) => row.planned > 0 || row.actual > 0))

function focusForm() {
  formRef.value?.querySelector('select')?.focus()
}

function saveBudget() {
  financeStore.upsertCategoryBudget({ ...form.value, month_key: monthKey.value })
  form.value = { category: categories.value[0] || 'Mercado', planned: 0 }
}

function categoryLabel(category) {
  return CATEGORY_LABELS[category] || category
}

function formatMoney(value) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value || 0))
}

function riskLabel(risk) {
  return {
    ok: 'Tudo certo',
    attention: 'Atenção',
    overrun: 'Risco',
    critical: 'Crítico',
  }[risk] || risk
}
function currentBudgetDate() {
  const now = new Date()
  const year = normalizeYear(financeStore.state.settings?.year)
  const month = normalizeMonth(financeStore.state.settings?.selectedMonth)
  const day = Math.min(now.getDate(), new Date(year, month, 0).getDate())
  return new Date(year, month - 1, day, 12)
}

function normalizeMonth(value) {
  const month = Number(value)
  return Number.isInteger(month) && month >= 1 && month <= 12 ? month : new Date().getMonth() + 1
}

function normalizeYear(value) {
  const year = Number(value)
  return Number.isInteger(year) && year >= 2000 ? year : new Date().getFullYear()
}
</script>

<style scoped>
.panel,
.budget-table {
  padding: 1rem;
  border: 1px solid var(--divider);
  border-radius: var(--radius-sm);
  background: var(--surface-ledger);
  box-shadow: none;
}

.budget-form {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(150px, 0.35fr) auto;
  align-items: end;
  gap: 0.75rem;
}

label {
  display: grid;
  gap: 0.4rem;
  color: var(--text-primary);
  font-size: 0.84rem;
}

.field-hint {
  color: var(--text-muted);
  font-size: 0.72rem;
  line-height: 1.4;
}

input,
select {
  width: 100%;
  min-width: 0;
  min-height: 42px;
  padding: 0.62rem 0.72rem;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  background: var(--bg-input);
  color: var(--text-primary);
}

input:focus-visible,
select:focus-visible {
  outline: none;
  border-color: var(--input-border-focus);
  box-shadow: var(--focus-ring);
}

.budget-table {
  display: grid;
  gap: 0.45rem;
  overflow-x: auto;
}

.budget-row {
  min-width: 680px;
  display: grid;
  grid-template-columns: 1.1fr repeat(4, minmax(0, 1fr));
  gap: 0.75rem;
  align-items: center;
  padding: 0.72rem 0.8rem;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  background: color-mix(in srgb, var(--bg-hover) 72%, var(--bg-panel));
  color: var(--text-secondary);
}

.budget-row.header {
  border-color: transparent;
  background: transparent;
  color: var(--text-primary);
  font-weight: 800;
}

.risk {
  width: fit-content;
  border-radius: 999px;
  padding: 0.25rem 0.55rem;
  font-size: 0.76rem;
  font-weight: 800;
}

.risk.ok { color: var(--income); background: var(--income-dim); }
.risk.attention { color: var(--warning); background: var(--warning-dim); }
.risk.overrun,
.risk.critical { color: var(--danger); background: var(--danger-dim); }

@media (max-width: 760px) {
  .budget-form {
    grid-template-columns: 1fr;
  }

  .budget-row {
    min-width: 0;
    grid-template-columns: 1fr 1fr;
  }

  .budget-row.header {
    display: none;
  }
}
</style>
