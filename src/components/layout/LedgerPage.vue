<template>
  <div class="ledger-page" :data-testid="testid || undefined">
    <header v-if="title || eyebrow || description || $slots.actions" class="ledger-page__header">
      <div>
        <p v-if="eyebrow" class="ledger-page__eyebrow">{{ eyebrow }}</p>
        <h1 v-if="title">{{ title }}</h1>
        <p v-if="description" class="ledger-page__description">{{ description }}</p>
      </div>
      <div v-if="$slots.actions" class="ledger-page__actions">
        <slot name="actions" />
      </div>
    </header>
    <slot />
  </div>
</template>

<script setup>
defineProps({
  eyebrow: { type: String, default: '' },
  title: { type: String, default: '' },
  description: { type: String, default: '' },
  testid: { type: String, default: '' },
})
</script>

<style scoped>
.ledger-page {
  width: min(var(--content-max), 100%);
  min-width: 0;
  display: grid;
  align-content: start;
  gap: var(--section-gap);
  margin: 0 auto;
  padding: var(--content-pad);
  background: transparent;
}

.ledger-page__header {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 1rem;
  padding: 0.1rem 0 1rem;
  border-bottom: 1px solid var(--divider);
}

.ledger-page__eyebrow {
  margin: 0;
  color: var(--accent);
  font-size: var(--text-xs);
  font-weight: 800;
  letter-spacing: var(--eyebrow-letter-spacing);
  text-transform: uppercase;
}

.ledger-page h1 {
  margin: 0.12rem 0 0;
  color: var(--text-primary);
  font-size: var(--page-title-size);
  font-weight: var(--page-title-weight);
  line-height: var(--page-title-line-height);
  letter-spacing: 0;
}

.ledger-page__description {
  max-width: 760px;
  margin: 0.35rem 0 0;
  color: var(--text-secondary);
  font-size: var(--page-subtitle-size);
  line-height: 1.5;
}

.ledger-page__actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  flex-wrap: wrap;
  gap: 0.6rem;
}

@media (max-width: 720px) {
  .ledger-page {
    padding: 0.8rem;
  }

  .ledger-page__header {
    display: grid;
    align-items: stretch;
  }
}
</style>
