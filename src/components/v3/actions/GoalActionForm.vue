<template>
  <section class="goal-action-form" data-testid="v34-goal-action-form">
    <AppInput
      label="Nome"
      :model-value="draft.name"
      placeholder="Reserva de emergência"
      @update:model-value="patch({ name: $event })"
    />
    <AppMoneyInput
      label="Valor alvo"
      :model-value="draft.targetAmount ?? draft.target_amount"
      @update:model-value="patch({ targetAmount: $event, target_amount: $event })"
    />
    <AppMoneyInput
      label="Valor atual"
      :model-value="draft.currentAmount ?? draft.current_amount"
      @update:model-value="patch({ currentAmount: $event, current_amount: $event })"
    />
    <AppInput
      label="Data alvo"
      type="date"
      :model-value="draft.targetDate || draft.target_date"
      @update:model-value="patch({ targetDate: $event, target_date: $event })"
    />
    <AppMoneyInput
      label="Aporte mensal"
      :model-value="draft.monthlyContribution ?? draft.monthly_contribution"
      @update:model-value="patch({ monthlyContribution: $event, monthly_contribution: $event })"
    />
  </section>
</template>

<script setup>
import { computed } from 'vue'
import AppInput from '@/components/ui/AppInput.vue'
import AppMoneyInput from '@/components/ui/AppMoneyInput.vue'

const props = defineProps({
  modelValue: { type: Object, default: () => ({}) },
})

const emit = defineEmits(['update:modelValue'])

const draft = computed(() => props.modelValue || {})

function patch(values) {
  emit('update:modelValue', { ...draft.value, ...values })
}
</script>

<style scoped>
.goal-action-form {
  display: grid;
  gap: 0.8rem;
}
</style>
