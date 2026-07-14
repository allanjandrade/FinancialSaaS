<template>
  <header v-if="title || $slots.actions" class="page-header" data-testid="page-header">
    <div>
      <p v-if="eyebrow" class="page-header__eyebrow">{{ eyebrow }}</p>
      <h1 v-if="title">{{ title }}</h1>
      <p v-if="description" class="page-header__description">{{ description }}</p>
    </div>
    <div v-if="$slots.actions" class="page-header__actions">
      <slot name="actions" />
    </div>
  </header>
</template>

<script setup>
defineProps({
  eyebrow: { type: String, default: '' },
  title: { type: String, default: '' },
  description: { type: String, default: '' },
})
</script>

<style scoped>
.page-header {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 1rem;
  padding: 0.15rem 0 1rem;
  border-bottom: 1px solid var(--divider);
  background: transparent;
  box-shadow: none;
}

.page-header__eyebrow {
  margin: 0;
  color: var(--accent);
  font-family: var(--font-sans);
  font-size: var(--text-xs);
  font-weight: 700;
  letter-spacing: var(--eyebrow-letter-spacing);
  text-transform: uppercase;
}

h1 {
  margin: 0.12rem 0 0;
  color: var(--text-primary);
  font-family: var(--font-display);
  font-size: var(--page-title-size);
  font-weight: var(--page-title-weight);
  line-height: var(--page-title-line-height);
  letter-spacing: 0;
}

.page-header__description {
  max-width: 720px;
  margin: 0.35rem 0 0;
  color: var(--text-secondary);
  font-family: var(--font-sans);
  font-size: var(--page-subtitle-size);
  line-height: 1.5;
}

.page-header__actions {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  flex-wrap: wrap;
  justify-content: flex-end;
}

@media (max-width: 620px) {
  .page-header {
    display: grid;
    align-items: stretch;
    gap: 0.75rem;
  }
}
</style>
