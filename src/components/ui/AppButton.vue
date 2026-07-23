<template>
  <component
    :is="tag"
    :type="tag === 'button' ? type : undefined"
    :to="tag === 'router-link' ? to : undefined"
    :disabled="disabled || loading"
    :title="disabled && disabledReason ? disabledReason : undefined"
    :aria-busy="loading"
    class="app-button"
    :class="[`app-button--${variant}`, { 'app-button--loading': loading, 'app-button--block': block }]"
    data-testid="app-button"
    @click="onClick"
  >
    <span v-if="loading" class="app-button__spinner" aria-hidden="true" />
    <slot />
  </component>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  variant: {
    type: String,
    default: 'primary',
    validator: (value) => ['primary', 'secondary', 'destructive', 'ghost'].includes(value),
  },
  type: { type: String, default: 'button' },
  to: { type: [String, Object], default: '' },
  loading: { type: Boolean, default: false },
  disabled: { type: Boolean, default: false },
  disabledReason: { type: String, default: '' },
  block: { type: Boolean, default: false },
})

const emit = defineEmits(['click'])

const tag = computed(() => (props.to ? 'router-link' : 'button'))

function onClick(event) {
  if (props.disabled || props.loading) {
    event.preventDefault()
    return
  }
  emit('click', event)
}
</script>

<style scoped>
.app-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.45rem;
  min-height: var(--touch-target-min);
  padding: 0.7rem 1.1rem;
  border-radius: var(--radius-sm);
  border: 1px solid transparent;
  font-size: 0.875rem;
  font-weight: 800;
  line-height: 1.2;
  text-decoration: none;
  cursor: pointer;
  transition: transform 0.15s ease, background 0.15s ease, border-color 0.15s ease, box-shadow 0.15s ease, color 0.15s ease, filter 0.15s ease;
}

.app-button--primary {
  border-color: color-mix(in srgb, var(--accent) 82%, #fff);
  background: var(--gradient-accent);
  color: #fff;
  box-shadow: 0 10px 22px -18px var(--accent);
}

.app-button--primary:hover:not(:disabled) {
  filter: saturate(1.05) brightness(1.02);
  box-shadow: 0 12px 28px -18px var(--accent);
  /* Fluid ledger exception: intentional action hover state. */
  transform: translateY(-1px);
}

.app-button--secondary {
  background: color-mix(in srgb, var(--bg-panel) 86%, var(--bg-hover));
  border-color: var(--border-color);
  color: var(--text-primary);
}

.app-button--secondary:hover:not(:disabled) {
  background: var(--bg-hover);
  border-color: color-mix(in srgb, var(--accent) 22%, var(--border-color));
  /* Fluid ledger exception: intentional action hover state. */
  transform: translateY(-1px);
}

.app-button--destructive {
  border-color: color-mix(in srgb, var(--danger) 36%, var(--border-color));
  background: var(--expense-dim);
  color: var(--danger);
  box-shadow: none;
}

.app-button--destructive:hover:not(:disabled) {
  border-color: color-mix(in srgb, var(--danger) 58%, var(--border-color));
  background: color-mix(in srgb, var(--danger) 13%, transparent);
  /* Fluid ledger exception: intentional action hover state. */
  transform: translateY(-1px);
}

.app-button--ghost {
  background: transparent;
  color: var(--text-secondary);
}

.app-button--ghost:hover:not(:disabled) {
  background: var(--bg-hover);
  color: var(--text-primary);
  /* Fluid ledger exception: intentional action hover state. */
  transform: translateY(-1px);
}

.app-button--block {
  width: 100%;
}

.app-button:disabled {
  opacity: 0.55;
  cursor: not-allowed;
  box-shadow: none;
}

.app-button__spinner {
  width: 16px;
  height: 16px;
  border: 2px solid rgba(255, 255, 255, 0.35);
  border-top-color: currentColor;
  border-radius: 50%;
  animation: app-button-spin 0.7s linear infinite;
}

@keyframes app-button-spin {
  to { transform: rotate(360deg); }
}
</style>
