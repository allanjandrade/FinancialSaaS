<template>
  <section class="action-form" data-testid="v34-income-action-form">
    <AppInput
      label="Descrição"
      :model-value="draft.description"
      placeholder="Receita mensal"
      @update:model-value="patch({ description: $event })"
    />
    <AppMoneyInput
      label="Valor"
      :model-value="draft.amount"
      required
      @update:model-value="patch({ amount: $event })"
    />
    <AppInput
      label="Data"
      type="date"
      :model-value="draft.date"
      required
      @update:model-value="patch({ date: $event })"
    />
    <AppSelect
      label="Tipo"
      :model-value="draft.type || 'fixed'"
      :options="typeOptions"
      @update:model-value="patch({ type: $event })"
    />
  </section>
</template>

<script setup>
import { computed } from 'vue'
import AppInput from '@/components/ui/AppInput.vue'
import AppMoneyInput from '@/components/ui/AppMoneyInput.vue'
import AppSelect from '@/components/ui/AppSelect.vue'

const props = defineProps({
  modelValue: { type: Object, default: () => ({}) },
})

const emit = defineEmits(['update:modelValue'])

const typeOptions = [
  { value: 'fixed', label: 'Receita fixa' },
  { value: 'variable', label: 'Receita variável' },
  { value: 'extra', label: 'Receita extra' },
]

const draft = computed(() => props.modelValue || {})

function patch(values) {
  emit('update:modelValue', { ...draft.value, ...values })
}
</script>

<style scoped>
.action-form {
  display: grid;
  gap: 0.8rem;
}
</style>
