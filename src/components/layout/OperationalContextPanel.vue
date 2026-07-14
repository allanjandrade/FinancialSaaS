<template>
  <aside class="operational-context" data-testid="operational-context-panel" :aria-label="title">
    <header class="operational-context__header">
      <span v-if="eyebrow">{{ eyebrow }}</span>
      <h2>{{ title }}</h2>
      <p v-if="subtitle">{{ subtitle }}</p>
    </header>

    <div v-if="items.length" class="operational-context__items">
      <article
        v-for="item in items"
        :key="item.id || item.label"
        class="operational-context__item"
        :class="item.tone ? `is-${item.tone}` : ''"
      >
        <span>{{ item.label }}</span>
        <strong>{{ item.value }}</strong>
        <small v-if="item.hint">{{ item.hint }}</small>
      </article>
    </div>

    <p v-else-if="emptyMessage" class="operational-context__empty">{{ emptyMessage }}</p>

    <div v-if="alerts.length" class="operational-context__alerts">
      <article
        v-for="alert in alerts"
        :key="alert.id || alert.title"
        class="operational-context__alert"
        :class="alert.tone ? `is-${alert.tone}` : ''"
      >
        <strong>{{ alert.title }}</strong>
        <p>{{ alert.message }}</p>
      </article>
    </div>

    <div v-if="$slots.actions" class="operational-context__actions">
      <slot name="actions" />
    </div>
  </aside>
</template>

<script setup>
defineProps({
  eyebrow: { type: String, default: '' },
  title: { type: String, required: true },
  subtitle: { type: String, default: '' },
  emptyMessage: { type: String, default: '' },
  items: { type: Array, default: () => [] },
  alerts: { type: Array, default: () => [] },
})
</script>

<style scoped>
.operational-context {
  min-width: 0;
  display: grid;
  align-content: start;
  gap: 0.9rem;
  padding: 1rem;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-lg);
  background: var(--gradient-panel);
  box-shadow: var(--shadow-card);
}

.operational-context__header {
  display: grid;
  gap: 0.25rem;
}

.operational-context__header span {
  color: var(--accent);
  font-size: var(--text-xs);
  font-weight: 850;
  letter-spacing: var(--eyebrow-letter-spacing);
  text-transform: uppercase;
}

.operational-context__header h2,
.operational-context__header p,
.operational-context__alert p {
  margin: 0;
}

.operational-context__header h2 {
  color: var(--text-primary);
  font-size: var(--text-lg);
  line-height: 1.2;
}

.operational-context__header p,
.operational-context__item span,
.operational-context__item small,
.operational-context__empty,
.operational-context__alert p {
  color: var(--text-secondary);
  font-size: var(--text-sm);
  line-height: 1.45;
}

.operational-context__items,
.operational-context__alerts {
  display: grid;
  gap: 0.65rem;
}

.operational-context__item,
.operational-context__alert {
  display: grid;
  gap: 0.2rem;
  padding: 0.75rem;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  background: color-mix(in srgb, var(--bg-panel) 82%, var(--bg-hover));
}

.operational-context__item strong {
  color: var(--text-primary);
  font-family: var(--font-mono);
  font-size: 1rem;
  font-variant-numeric: tabular-nums;
}

.operational-context__alert strong {
  color: var(--text-primary);
  font-size: var(--text-sm);
}

.operational-context__item.is-success,
.operational-context__alert.is-success {
  border-color: color-mix(in srgb, var(--success) 28%, var(--border-color));
  background: var(--income-dim);
}

.operational-context__item.is-warning,
.operational-context__alert.is-warning {
  border-color: color-mix(in srgb, var(--warning) 28%, var(--border-color));
  background: var(--savings-dim);
}

.operational-context__item.is-danger,
.operational-context__alert.is-danger {
  border-color: color-mix(in srgb, var(--danger) 28%, var(--border-color));
  background: var(--expense-dim);
}

.operational-context__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}
</style>
