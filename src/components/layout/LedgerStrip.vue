<template>
  <div class="ledger-strip" :data-testid="testid || undefined">
    <article
      v-for="item in items"
      :key="item.id || item.label"
      class="ledger-strip__item"
      :class="item.tone ? `is-${item.tone}` : ''"
    >
      <span>{{ item.label }}</span>
      <strong>{{ item.value }}</strong>
      <small v-if="item.hint">{{ item.hint }}</small>
    </article>
  </div>
</template>

<script setup>
defineProps({
  items: { type: Array, default: () => [] },
  testid: { type: String, default: '' },
})
</script>

<style scoped>
.ledger-strip {
  min-width: 0;
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  border-top: 1px solid var(--divider);
  border-bottom: 1px solid var(--divider);
  background: var(--surface-muted);
}

.ledger-strip__item {
  min-width: 0;
  display: grid;
  gap: 0.2rem;
  padding: 0.85rem 1rem;
  border-right: 1px solid var(--divider);
}

.ledger-strip__item:last-child {
  border-right: 0;
}

.ledger-strip__item span,
.ledger-strip__item small {
  color: var(--text-secondary);
  font-size: var(--text-xs);
  line-height: 1.35;
}

.ledger-strip__item strong {
  color: var(--text-primary);
  font-family: var(--font-mono);
  font-size: 1rem;
  font-variant-numeric: tabular-nums;
}

.ledger-strip__item.is-success strong {
  color: var(--income);
}

.ledger-strip__item.is-warning strong {
  color: var(--warning);
}

.ledger-strip__item.is-danger strong {
  color: var(--danger);
}

@media (max-width: 620px) {
  .ledger-strip {
    grid-template-columns: 1fr;
  }

  .ledger-strip__item {
    border-right: 0;
    border-bottom: 1px solid var(--divider);
  }

  .ledger-strip__item:last-child {
    border-bottom: 0;
  }
}
</style>
