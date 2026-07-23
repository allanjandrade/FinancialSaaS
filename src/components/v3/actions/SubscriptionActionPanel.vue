<template>
  <section class="subscription-action" data-testid="v34-subscription-action-panel">
    <dl class="subscription-action__target">
      <div>
        <dt>Assinatura</dt>
        <dd>{{ targetName }}</dd>
      </div>
      <div>
        <dt>Valor mensal</dt>
        <dd>{{ formatMoney(targetAmount) }}</dd>
      </div>
    </dl>

    <div class="subscription-action__link">
      <span>Acesso externo</span>
      <a v-if="execution?.externalUrl" :href="execution.externalUrl" target="_blank" rel="noopener noreferrer">
        {{ execution.externalUrl }}
      </a>
      <p v-else>Sem link externo cadastrado. Continue pela tela de assinaturas.</p>
    </div>

    <AppSelect
      label="Ação"
      :model-value="draft.action || 'pause'"
      :options="actionOptions"
      @update:model-value="patch({ action: $event })"
    />
    <AppInput
      v-if="draft.action === 'updateDate'"
      label="Novo vencimento"
      type="date"
      :model-value="draft.nextBillingDate"
      required
      @update:model-value="patch({ nextBillingDate: $event })"
    />
  </section>
</template>

<script setup>
import { computed } from 'vue'
import AppInput from '@/components/ui/AppInput.vue'
import AppSelect from '@/components/ui/AppSelect.vue'

const props = defineProps({
  execution: { type: Object, default: null },
  modelValue: { type: Object, default: () => ({}) },
})

const emit = defineEmits(['update:modelValue'])

const actionOptions = [
  { value: 'pause', label: 'Pausar' },
  { value: 'cancel', label: 'Cancelar' },
  { value: 'updateDate', label: 'Atualizar data' },
]

const draft = computed(() => props.modelValue || {})
const targetName = computed(() => props.execution?.target?.name || 'Assinatura sem nome')
const targetAmount = computed(() => props.execution?.target?.monthlyAmount || props.execution?.impactAmount || 0)
const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })

function formatMoney(value) {
  const parsed = Number(value)
  return brl.format(Number.isFinite(parsed) ? parsed : 0).replace(/\s+/g, ' ')
}

function patch(values) {
  emit('update:modelValue', { ...draft.value, ...values })
}
</script>

<style scoped>
.subscription-action {
  display: grid;
  gap: 0.85rem;
}

.subscription-action__target {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.65rem;
  margin: 0;
}

.subscription-action__target div,
.subscription-action__link {
  min-width: 0;
  border: 1px solid var(--divider);
  border-radius: var(--radius-sm);
  background: var(--surface-ledger);
  padding: 0.75rem;
}

.subscription-action__target dt,
.subscription-action__link span {
  margin: 0 0 0.2rem;
  color: var(--text-muted);
  font-size: 0.72rem;
  font-weight: 800;
  text-transform: uppercase;
}

.subscription-action__target dd {
  margin: 0;
  color: var(--text-primary);
  font-weight: 800;
  overflow-wrap: anywhere;
}

.subscription-action__link {
  display: grid;
  gap: 0.25rem;
}

.subscription-action__link a,
.subscription-action__link p {
  margin: 0;
  color: var(--text-secondary);
  font-size: 0.82rem;
  line-height: 1.45;
  overflow-wrap: anywhere;
}

.subscription-action__link a {
  color: var(--accent);
  font-weight: 700;
}

@media (max-width: 420px) {
  .subscription-action__target {
    grid-template-columns: 1fr;
  }
}
</style>
