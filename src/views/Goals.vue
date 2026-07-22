<template>
  <PageShell
    eyebrow="Planejamento"
    title="Metas financeiras"
    description="Planeje reservas, compras e objetivos de economia."
    testid="goals-page"
  >
    <template #actions>
      <button class="primary-button" type="button" @click="focusForm">Criar meta</button>
    </template>

    <section class="panel">
      <form ref="formRef" class="goal-form" @submit.prevent="addGoal">
        <label>
          Nome
          <input v-model="form.name" data-testid="goal-name" required />
        </label>
        <label>
          Tipo
          <select v-model="form.type">
            <option v-for="type in goalTypes" :key="type" :value="type">{{ typeLabel(type) }}</option>
          </select>
        </label>
        <label>
          Valor alvo
          <input v-model.number="form.target_amount" data-testid="goal-target" type="number" min="0" step="0.01" required />
        </label>
        <label>
          Valor atual
          <input v-model.number="form.current_amount" type="number" min="0" step="0.01" />
        </label>
        <label>
          Aporte mensal
          <input v-model.number="form.monthly_contribution" type="number" min="0" step="0.01" />
        </label>
        <label>
          Data alvo
          <input v-model="form.target_date" type="date" />
        </label>
        <button class="primary-button" data-testid="goal-submit" type="submit">Criar meta</button>
      </form>
    </section>

    <EmptyState
      v-if="!goals.length"
      :icon="Target"
      title="Nenhuma meta criada"
      description="Crie sua primeira meta para acompanhar progresso sem movimentar saldo automaticamente."
      action-label="Criar meta"
      @action="focusForm"
    />

    <ResponsiveGrid v-else variant="sections">
      <article v-for="goal in goals" :key="goal.id" class="goal-card">
        <div>
          <strong>{{ goal.name }}</strong>
          <span>{{ typeLabel(goal.type) }}</span>
        </div>
        <progress :value="goal.current_amount" :max="Math.max(goal.target_amount, 1)" />
        <p>{{ goalProgress(goal) }}% concluído - {{ formatMoney(goal.monthly_contribution) }}/mês</p>
      </article>
    </ResponsiveGrid>
  </PageShell>
</template>

<script setup>
import { computed, ref } from 'vue'
import { Target } from 'lucide-vue-next'
import EmptyState from '@/components/EmptyState.vue'
import PageShell from '@/components/layout/PageShell.vue'
import ResponsiveGrid from '@/components/layout/ResponsiveGrid.vue'
import { useFinanceStore } from '@/stores/finance.js'
import { PLANNING_GOAL_TYPES } from '@/utils/planning-engine.js'

const financeStore = useFinanceStore()
const goalTypes = PLANNING_GOAL_TYPES
const formRef = ref(null)
const form = ref(emptyForm())
const goals = computed(() => financeStore.state.planningGoals || [])

function emptyForm() {
  return {
    name: '',
    type: 'reserva_emergencia',
    target_amount: 0,
    current_amount: 0,
    monthly_contribution: 0,
    target_date: '',
  }
}

function focusForm() {
  formRef.value?.querySelector('input')?.focus()
}

function addGoal() {
  financeStore.addPlanningGoal(form.value)
  form.value = emptyForm()
}

function goalProgress(goal) {
  if (!goal.target_amount) return 0
  return Math.min(100, Math.round((Number(goal.current_amount || 0) / Number(goal.target_amount)) * 100))
}

function typeLabel(type) {
  return {
    reserva_emergencia: 'Reserva de emergencia',
    compra_planejada: 'Compra planejada',
    quitar_divida: 'Quitar divida',
    investimento_mensal: 'Investimento mensal',
    viagem: 'Viagem',
    entrada_bem: 'Entrada de bem',
    reduzir_categoria: 'Reduzir categoria',
  }[type] || type
}

function formatMoney(value) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value || 0))
}
</script>

<style scoped>
.panel,
.goal-card {
  padding: 1rem;
  border: 1px solid var(--divider);
  border-radius: var(--radius-sm);
  background: var(--surface-ledger);
  box-shadow: none;
}

.goal-form {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0.75rem;
  align-items: end;
}

label,
.goal-card {
  display: grid;
  gap: 0.4rem;
}

label {
  color: var(--text-primary);
  font-size: 0.84rem;
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

.goal-card {
  transition: border-color 0.16s ease, background 0.16s ease;
}

.goal-card:hover {
  border-color: color-mix(in srgb, var(--accent) 28%, var(--border-color));
  background: var(--surface-muted);
}

.goal-card strong {
  color: var(--text-primary);
}

.goal-card span,
.goal-card p {
  margin: 0;
  color: var(--text-secondary);
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

@media (max-width: 820px) {
  .goal-form {
    grid-template-columns: 1fr;
  }
}
</style>
