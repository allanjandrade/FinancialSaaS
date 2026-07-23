<template>
  <section class="subscription-cut" data-testid="v34-subscription-cut-review">
    <dl class="subscription-cut__impact">
      <div>
        <dt>Economia mensal</dt>
        <dd>{{ formatMoney(monthlyImpact) }}</dd>
      </div>
      <div>
        <dt>Impacto anual</dt>
        <dd>{{ formatMoney(annualImpact) }}</dd>
      </div>
    </dl>

    <AppSelect
      label="Ação"
      :model-value="draft.action || 'pause'"
      :options="actionOptions"
      @update:model-value="patch({ action: $event })"
    />

    <fieldset class="subscription-cut__options">
      <legend>Assinaturas para revisar</legend>
      <label v-for="option in options" :key="option.id">
        <input
          type="checkbox"
          :value="option.id"
          :checked="selectedIds.includes(String(option.id))"
          :disabled="isOnlySelectedOption(option.id)"
          @change="toggleOption(option.id, $event.target.checked)"
        />
        <span>
          <strong>{{ option.name }}</strong>
          <small>{{ formatMoney(option.monthlyAmount) }}/mês</small>
        </span>
      </label>
      <p v-if="options.length && !selectedIds.length">Selecione uma assinatura para estimar o impacto.</p>
      <p v-else-if="options.length">Mantenha ao menos uma assinatura marcada para revisar.</p>
      <p v-if="!options.length">Nenhuma assinatura dispensável disponível para seleção.</p>
    </fieldset>
  </section>
</template>

<script setup>
import { computed } from 'vue'
import AppSelect from '@/components/ui/AppSelect.vue'

const props = defineProps({
  execution: { type: Object, default: null },
  modelValue: { type: Object, default: () => ({}) },
})

const emit = defineEmits(['update:modelValue'])

const actionOptions = [
  { value: 'pause', label: 'Pausar' },
  { value: 'cancel', label: 'Cancelar' },
]

const draft = computed(() => props.modelValue || {})
const options = computed(() => (Array.isArray(props.execution?.options) ? props.execution.options : []))
const selectedIds = computed(() => {
  const ids = draft.value.subscriptionIds || []
  return Array.isArray(ids) ? ids.map(String) : []
})
const selectedOptions = computed(() => options.value.filter((option) => selectedIds.value.includes(String(option.id))))
const monthlyImpact = computed(() => {
  return selectedOptions.value.reduce((sum, option) => sum + money(option.monthlyAmount), 0)
})
const annualImpact = computed(() => monthlyImpact.value * 12)
const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })

function money(value) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function formatMoney(value) {
  return brl.format(money(value)).replace(/\s+/g, ' ')
}

function patch(values) {
  emit('update:modelValue', { ...draft.value, ...values })
}

function isOnlySelectedOption(id) {
  return selectedIds.value.length === 1 && selectedIds.value.includes(String(id))
}

function toggleOption(id, checked) {
  const normalizedId = String(id)
  if (!checked && isOnlySelectedOption(normalizedId)) return

  const nextIds = checked
    ? [...new Set([...selectedIds.value, normalizedId])]
    : selectedIds.value.filter((selectedId) => selectedId !== normalizedId)

  patch({ subscriptionIds: nextIds })
}
</script>

<style scoped>
.subscription-cut {
  display: grid;
  gap: 0.85rem;
}

.subscription-cut__impact {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.65rem;
  margin: 0;
}

.subscription-cut__impact div {
  border: 1px solid var(--divider);
  border-radius: var(--radius-sm);
  background: var(--surface-ledger);
  padding: 0.75rem;
}

.subscription-cut__impact dt {
  margin: 0 0 0.2rem;
  color: var(--text-muted);
  font-size: 0.72rem;
  font-weight: 800;
  text-transform: uppercase;
}

.subscription-cut__impact dd {
  margin: 0;
  color: var(--income);
  font-weight: 900;
}

.subscription-cut__options {
  display: grid;
  gap: 0.55rem;
  margin: 0;
  border: 1px solid var(--divider);
  border-radius: var(--radius-sm);
  padding: 0.75rem;
}

.subscription-cut__options legend {
  padding: 0 0.25rem;
  color: var(--text-muted);
  font-size: 0.72rem;
  font-weight: 800;
  text-transform: uppercase;
}

.subscription-cut__options label {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  gap: 0.6rem;
  align-items: center;
  color: var(--text-primary);
}

.subscription-cut__options input {
  width: 16px;
  height: 16px;
  accent-color: var(--accent);
}

.subscription-cut__options span {
  display: flex;
  justify-content: space-between;
  gap: 0.75rem;
  min-width: 0;
}

.subscription-cut__options strong,
.subscription-cut__options small {
  overflow-wrap: anywhere;
}

.subscription-cut__options small,
.subscription-cut__options p {
  margin: 0;
  color: var(--text-secondary);
}

@media (max-width: 420px) {
  .subscription-cut__impact {
    grid-template-columns: 1fr;
  }

  .subscription-cut__options span {
    display: grid;
    gap: 0.15rem;
  }
}
</style>
