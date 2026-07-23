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
      :model-value="draft.type || DEFAULT_INCOME_TYPE"
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
import { OFFICIAL_INCOME_TYPES } from '@/constants/finance.js'

const props = defineProps({
  modelValue: { type: Object, default: () => ({}) },
})

const emit = defineEmits(['update:modelValue'])

const ASSISTED_INCOME_TYPES = ['Salário', 'Freelancer', 'Outros']
  .filter((type) => OFFICIAL_INCOME_TYPES.includes(type))
const DEFAULT_INCOME_TYPE = ASSISTED_INCOME_TYPES[0] || 'Outros'
const typeOptions = ASSISTED_INCOME_TYPES.map((type) => ({ value: type, label: type }))

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
