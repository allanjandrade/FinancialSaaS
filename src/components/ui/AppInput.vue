<template>
  <div class="app-field" :class="{ 'app-field--error': !!errorMessage }">
    <label v-if="label" :for="inputId" class="app-field__label">{{ label }}</label>
    <input
      :id="inputId"
      ref="inputRef"
      :type="type"
      :value="modelValue"
      :placeholder="placeholder"
      :required="required"
      :disabled="disabled"
      :autocomplete="autocomplete"
      :minlength="minlength || undefined"
      :maxlength="maxlength || undefined"
      :aria-invalid="!!errorMessage"
      :aria-describedby="describedBy"
      class="app-input"
      :class="{ 'app-input--error': !!errorMessage }"
      data-testid="app-input"
      @input="onInput"
      @keydown.enter="onEnter"
    />
    <p v-if="helpText && !errorMessage" :id="helpId" class="app-field__help">{{ helpText }}</p>
    <p v-if="errorMessage" :id="errorId" class="app-field__error" role="alert">{{ errorMessage }}</p>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'

const props = defineProps({
  modelValue: { type: [String, Number], default: '' },
  label: { type: String, default: '' },
  placeholder: { type: String, default: '' },
  helpText: { type: String, default: '' },
  errorMessage: { type: String, default: '' },
  type: { type: String, default: 'text' },
  required: { type: Boolean, default: false },
  disabled: { type: Boolean, default: false },
  autocomplete: { type: String, default: '' },
  minlength: { type: [String, Number], default: '' },
  maxlength: { type: [String, Number], default: '' },
  autofocus: { type: Boolean, default: false },
  id: { type: String, default: '' },
  submitOnEnter: { type: Boolean, default: false },
})

const emit = defineEmits(['update:modelValue', 'enter'])

const inputRef = ref(null)
const uid = Math.random().toString(36).slice(2, 9)
const inputId = computed(() => props.id || `app-input-${uid}`)
const helpId = computed(() => `${inputId.value}-help`)
const errorId = computed(() => `${inputId.value}-error`)
const describedBy = computed(() => {
  if (props.errorMessage) return errorId.value
  if (props.helpText) return helpId.value
  return undefined
})

function onInput(event) {
  emit('update:modelValue', event.target.value)
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
