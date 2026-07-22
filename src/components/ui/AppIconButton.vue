<template>
  <button
    type="button"
    class="app-icon-button touch-target"
    :class="[`app-icon-button--${variant}`, { 'app-icon-button--active': active }]"
    :disabled="disabled"
    :aria-label="label"
    :title="label"
    data-testid="app-icon-button"
    @click="$emit('click', $event)"
  >
    <slot />
  </button>
</template>

<script setup>
defineProps({
  label: { type: String, required: true },
  variant: {
    type: String,
    default: 'ghost',
    validator: (value) => ['ghost', 'secondary', 'primary'].includes(value),
  },
  disabled: { type: Boolean, default: false },
  active: { type: Boolean, default: false },
})

defineEmits(['click'])
</script>

<style scoped>
.app-icon-button {
  display: inline-grid;
  place-items: center;
  width: var(--touch-target-min);
  height: var(--touch-target-min);
  border: 1px solid transparent;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--text-secondary);
  cursor: pointer;
  transition: background 0.15s ease, color 0.15s ease, border-color 0.15s ease;
}

.app-icon-button:hover:not(:disabled) {
  background: var(--bg-hover);
  color: var(--text-primary);
}

.app-icon-button--secondary {
  border-color: var(--border-color);
}

.app-icon-button--primary {
  background: var(--accent);
  color: #fff;
}

.app-icon-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
