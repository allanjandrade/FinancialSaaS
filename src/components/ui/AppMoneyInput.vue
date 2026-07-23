<template>
  <div class="app-field" :class="{ 'app-field--error': !!errorMessage }">
    <label v-if="label" :for="inputId" class="app-field__label">{{ label }}</label>
    <div class="app-money-input-wrap">
      <span class="app-money-input-prefix" aria-hidden="true">R$</span>
      <input
        :id="inputId"
        ref="inputRef"
        :value="displayValue"
        :placeholder="placeholder"
        :required="required"
        :disabled="disabled"
        :aria-invalid="!!errorMessage"
        :aria-describedby="describedBy"
        inputmode="decimal"
        class="app-money-input"
        :class="{ 'app-money-input--error': !!errorMessage }"
        data-testid="app-money-input"
        @input="onInput"
        @blur="onBlur"
        @keydown.enter="onEnter"
      />
    </div>
    <p v-if="helpText && !errorMessage" :id="helpId" class="app-field__help">{{ helpText }}</p>
    <p v-if="errorMessage" :id="errorId" class="app-field__error" role="alert">{{ errorMessage }}</p>
  </div>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { formatMoneyInput, parseMoneyInput } from '@/utils/money.js'

const props = defineProps({
  modelValue: { type: [Number, null], default: null },
  label: { type: String, default: '' },
  placeholder: { type: String, default: '0,00' },
  helpText: { type: String, default: '' },
  errorMessage: { type: String, default: '' },
  required: { type: Boolean, default: false },
  disabled: { type: Boolean, default: false },
  autofocus: { type: Boolean, default: false },
  id: { type: String, default: '' },
  submitOnEnter: { type: Boolean, default: false },
})

const emit = defineEmits(['update:modelValue', 'enter'])

const inputRef = ref(null)
const displayValue = ref('')
const uid = Math.random().toString(36).slice(2, 9)
const inputId = computed(() => props.id || `app-money-input-${uid}`)
const helpId = computed(() => `${inputId.value}-help`)
const errorId = computed(() => `${inputId.value}-error`)
const describedBy = computed(() => {
  if (props.errorMessage) return errorId.value
  if (props.helpText) return helpId.value
  return undefined
})

watch(
  () => props.modelValue,
  (value) => {
    if (value === null || value === undefined || value === '') {
      displayValue.value = ''
      return
    }
    displayValue.value = formatMoneyInput(value)
  },
  { immediate: true },
)

function onInput(event) {
  const raw = event.target.value
  displayValue.value = raw
  emit('update:modelValue', parseMoneyInput(raw))
}

function onBlur() {
  if (props.modelValue === null || props.modelValue === undefined || props.modelValue === '') {
    displayValue.value = ''
    return
  }
  displayValue.value = formatMoneyInput(props.modelValue)
}

function onEnter(event) {
  if (!props.submitOnEnter) return
  event.preventDefault()
  emit('enter')
}

onMounted(() => {
  if (props.autofocus) inputRef.value?.focus()
})
</script>

<style scoped>
.app-money-input-wrap {
  position: relative;
}

.app-money-input-prefix {
  position: absolute;
  left: 0.85rem;
  top: 50%;
  transform: translateY(-50%);
  color: var(--text-muted);
  font-size: var(--text-sm);
  font-weight: 600;
  pointer-events: none;
}

.app-money-input {
  padding-left: 2.4rem;
}
</style>
