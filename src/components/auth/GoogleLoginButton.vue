<template>
  <button
    type="button"
    class="google-button"
    :disabled="disabled"
    data-testid="google-login-button"
    @click="$emit('click')"
  >
    <slot>Continuar com Google</slot>
  </button>
</template>

<script setup>
defineProps({
  disabled: {
    type: Boolean,
    default: false,
  },
})

defineEmits(['click'])
</script>

<style scoped>
.google-button {
  border: 0;
  border-radius: 12px;
  padding: 0.9rem 1rem;
  background: #fff;
  color: #111827;
  font-weight: 900;
  cursor: pointer;
}

.google-button:disabled {
  opacity: 0.62;
  cursor: not-allowed;
}
</style>
