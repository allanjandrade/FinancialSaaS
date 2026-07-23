<template>
  <aside class="ledger-rail" :data-testid="testid || undefined" :aria-label="title || 'Contexto'">
    <header v-if="title || subtitle" class="ledger-rail__header">
      <h2 v-if="title">{{ title }}</h2>
      <p v-if="subtitle">{{ subtitle }}</p>
    </header>
    <slot />
  </aside>
</template>

<script setup>
defineProps({
  title: { type: String, default: '' },
  subtitle: { type: String, default: '' },
  testid: { type: String, default: '' },
})
</script>

<style scoped>
.ledger-rail {
  min-width: 0;
  display: grid;
  align-content: start;
  gap: 0.9rem;
  padding-left: 1rem;
  border-left: 1px solid var(--divider);
  background: transparent;
}

.ledger-rail__header {
  display: grid;
  gap: 0.25rem;
}

.ledger-rail h2,
.ledger-rail p {
  margin: 0;
}

.ledger-rail h2 {
  color: var(--text-primary);
  font-size: var(--text-lg);
  line-height: 1.25;
}

.ledger-rail p {
  color: var(--text-secondary);
  font-size: var(--text-sm);
  line-height: 1.45;
}

@media (max-width: 980px) {
  .ledger-rail {
    padding-left: 0;
    padding-top: 1rem;
    border-left: 0;
    border-top: 1px solid var(--divider);
  }
}
</style>
