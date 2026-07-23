<template>
  <section class="ledger-section" :class="{ 'ledger-section--divided': divided }" :data-testid="testid || undefined">
    <header v-if="title || eyebrow || description || $slots.actions" class="ledger-section__header">
      <div>
        <p v-if="eyebrow" class="ledger-section__eyebrow">{{ eyebrow }}</p>
        <h2 v-if="title">{{ title }}</h2>
        <p v-if="description" class="ledger-section__description">{{ description }}</p>
      </div>
      <div v-if="$slots.actions" class="ledger-section__actions">
        <slot name="actions" />
      </div>
    </header>
    <slot />
  </section>
</template>

<script setup>
defineProps({
  eyebrow: { type: String, default: '' },
  title: { type: String, default: '' },
  description: { type: String, default: '' },
  testid: { type: String, default: '' },
  divided: { type: Boolean, default: true },
})
</script>

<style scoped>
.ledger-section {
  min-width: 0;
  display: grid;
  gap: 1rem;
  padding: 0;
  background: transparent;
}

.ledger-section--divided {
  padding-top: 1rem;
  border-top: 1px solid var(--divider);
}

.ledger-section__header {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 1rem;
}

.ledger-section__eyebrow {
  margin: 0;
  color: var(--accent);
  font-size: var(--text-xs);
  font-weight: 800;
  letter-spacing: var(--eyebrow-letter-spacing);
  text-transform: uppercase;
}

.ledger-section h2,
.ledger-section__description {
  margin: 0;
}

.ledger-section h2 {
  color: var(--text-primary);
  font-size: var(--text-lg);
  line-height: 1.25;
}

.ledger-section__description {
  max-width: 680px;
  color: var(--text-secondary);
  font-size: var(--text-sm);
  line-height: 1.5;
}

.ledger-section__actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  flex-wrap: wrap;
  gap: 0.5rem;
}
</style>
