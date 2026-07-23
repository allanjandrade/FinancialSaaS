<template>
  <span class="app-badge" :class="`app-badge--${tone}`" data-testid="app-badge">
    <slot>{{ label }}</slot>
  </span>
</template>

<script setup>
defineProps({
  label: { type: String, default: '' },
  tone: {
    type: String,
    default: 'neutral',
    validator: (value) => ['neutral', 'success', 'warning', 'danger', 'premium', 'info'].includes(value),
  },
})
</script>

<style scoped>
.app-badge {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  min-height: 24px;
  padding: 0.18rem 0.55rem;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-pill);
  background: color-mix(in srgb, var(--bg-hover) 70%, transparent);
  color: var(--text-secondary);
  font-size: 0.75rem;
  font-weight: 600;
  letter-spacing: 0;
  text-transform: none;
}

.app-badge--success {
  border-color: color-mix(in srgb, var(--success) 35%, var(--border-color));
  background: var(--income-dim);
  color: var(--success);
}

.app-badge--warning {
  border-color: color-mix(in srgb, var(--warning) 35%, var(--border-color));
  background: var(--savings-dim);
  color: var(--warning);
}

.app-badge--danger {
  border-color: color-mix(in srgb, var(--danger) 35%, var(--border-color));
  background: var(--expense-dim);
  color: var(--danger);
}

.app-badge--premium {
  border-color: color-mix(in srgb, var(--accent-purple) 35%, var(--border-color));
  background: var(--blue-dim);
  color: var(--accent-purple);
}

.app-badge--info {
  border-color: color-mix(in srgb, var(--info) 35%, var(--border-color));
  background: var(--blue-dim);
  color: var(--info);
}
</style>
