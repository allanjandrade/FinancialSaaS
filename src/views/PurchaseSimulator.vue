<template>
  <PageShell
    eyebrow="Planejamento"
    title="Posso comprar?"
    description="Simule uma compra antes de comprometer seu mês."
    testid="purchase-simulator-page"
  >
    <section class="panel">
      <form class="simulator-form" @submit.prevent="runSimulation">
        <label>
          Nome da compra
          <input v-model="form.item_name" data-testid="sim-item" required />
        </label>
        <label>
          Valor
          <input v-model.number="form.amount" data-testid="sim-amount" type="number" min="0.01" step="0.01" required />
        </label>
        <label>
          Forma de pagamento
          <select v-model="form.payment_type" data-testid="sim-payment">
            <option value="cash">A vista</option>
            <option value="credit">Cartão</option>
          </select>
        </label>
        <label>
          Parcelas
          <input v-model.number="form.installments" data-testid="sim-installments" type="number" min="1" step="1" />
        </label>
        <label>
          Categoria
          <select v-model="form.category" data-testid="sim-category">
            <option v-for="category in categories" :key="category" :value="category">{{ category }}</option>
          </select>
        </label>
        <button class="primary-button" data-testid="sim-submit" type="submit">Simular compra</button>
      </form>
    </section>

    <article v-if="simulation" class="decision-card" :class="simulation.decision" data-testid="sim-result">
      <strong>{{ decisionLabel(simulation.decision) }}</strong>
      <p>Impacto mensal: {{ formatMoney(simulation.monthly_impact) }}. Nenhuma transação foi criada.</p>
      <ul>
        <li v-for="reason in simulation.reasons" :key="reason">{{ reason }}</li>
      </ul>
    </article>
  </PageShell>
</template>

<script setup>
import { ref } from 'vue'
import PageShell from '@/components/layout/PageShell.vue'
import { useFinanceStore } from '@/stores/finance.js'
import { BUDGET_CATEGORIES, simulatePlannedPurchase } from '@/utils/planning-engine.js'

const financeStore = useFinanceStore()
const categories = BUDGET_CATEGORIES
const form = ref({
  item_name: '',
  amount: 0,
  payment_type: 'cash',
  installments: 1,
  category: 'Outros',
  purchase_date: '2026-06-19',
})
const simulation = ref(null)

function runSimulation() {
  simulation.value = simulatePlannedPurchase(form.value, financeStore.state, new Date('2026-06-19T12:00:00'))
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

function formatMoney(value) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value || 0))
}
</script>

<style scoped>
.panel,
.decision-card {
  padding: 1rem;
  border: 1px solid var(--divider);
  border-radius: var(--radius-sm);
  background: var(--surface-ledger);
  box-shadow: none;
}

.simulator-form {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0.75rem;
  align-items: end;
}

label {
  display: grid;
  gap: 0.4rem;
  color: var(--text-primary);
  font-size: 0.84rem;
}

input,
select {
  width: 100%;
  min-width: 0;
  padding: 0.62rem;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  background: var(--bg-input);
  color: var(--text-primary);
}

.decision-card {
  display: grid;
  gap: 0.5rem;
}

.decision-card.can_buy_now { border-color: rgba(22, 163, 74, 0.45); }
.decision-card.not_recommended,
.decision-card.card_risk { border-color: rgba(220, 38, 38, 0.45); }

.decision-card p {
  margin: 0;
  color: var(--text-secondary);
}

@media (max-width: 820px) {
  .simulator-form {
    grid-template-columns: 1fr;
  }
}
</style>
