<template>
  <section class="ledger-empty-state" :data-testid="testid || undefined">
    <component v-if="icon" :is="icon" :size="32" aria-hidden="true" />
    <div>
      <h2>{{ title }}</h2>
      <p v-if="description">{{ description }}</p>
    </div>
    <slot name="actions" />
  </section>
</template>

<script setup>
defineProps({
  icon: { type: [Object, Function, String], default: null },
  title: { type: String, required: true },
  description: { type: String, default: '' },
  testid: { type: String, default: '' },
})
</script>

<style scoped>
.ledger-empty-state {
  min-height: 220px;
  display: grid;
  place-items: center;
  align-content: center;
  gap: 0.75rem;
  padding: 1.5rem;
  border: 1px dashed var(--divider-strong);
  border-radius: var(--radius-sm);
  background: var(--surface-muted);
  text-align: center;
}

.ledger-empty-state svg {
  color: var(--accent);
}

.ledger-empty-state h2,
.ledger-empty-state p {
  margin: 0;
}

.ledger-empty-state h2 {
  color: var(--text-primary);
  font-size: var(--text-lg);
}

.ledger-empty-state p {
  max-width: 520px;
  color: var(--text-secondary);
  font-size: var(--text-sm);
  line-height: 1.5;
}
</style>
