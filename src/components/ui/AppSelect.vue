<template>
  <div class="app-field" :class="{ 'app-field--error': !!errorMessage }">
    <label v-if="label" :for="selectId" class="app-field__label">{{ label }}</label>
    <select
      :id="selectId"
      :value="modelValue"
      :required="required"
      :disabled="disabled"
      :aria-invalid="!!errorMessage"
      :aria-describedby="describedBy"
      class="app-select"
      :class="{ 'app-input--error': !!errorMessage }"
      data-testid="app-select"
      @change="onChange"
    >
      <option v-if="placeholder" value="" disabled>{{ placeholder }}</option>
      <option v-for="option in options" :key="option.value" :value="option.value">
        {{ option.label }}
      </option>
    </select>
    <p v-if="helpText && !errorMessage" :id="helpId" class="app-field__help">{{ helpText }}</p>
    <p v-if="errorMessage" :id="errorId" class="app-field__error" role="alert">{{ errorMessage }}</p>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  modelValue: { type: [String, Number], default: '' },
  label: { type: String, default: '' },
  placeholder: { type: String, default: '' },
  helpText: { type: String, default: '' },
  errorMessage: { type: String, default: '' },
  options: { type: Array, default: () => [] },
  required: { type: Boolean, default: false },
  disabled: { type: Boolean, default: false },
  id: { type: String, default: '' },
})

const emit = defineEmits(['update:modelValue'])

const uid = Math.random().toString(36).slice(2, 9)
const selectId = computed(() => props.id || `app-select-${uid}`)
const helpId = computed(() => `${selectId.value}-help`)
const errorId = computed(() => `${selectId.value}-error`)
const describedBy = computed(() => {
  if (props.errorMessage) return errorId.value
  if (props.helpText) return helpId.value
  return undefined
})

function onChange(event) {
  emit('update:modelValue', event.target.value)
}
</script>
