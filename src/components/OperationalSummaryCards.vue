<template>
  <div class="summary-grid" data-testid="operational-summary">
    <article class="summary-card">
      <span>Eventos</span>
      <strong>{{ summary?.totals?.events || 0 }}</strong>
    </article>
    <article class="summary-card">
      <span>Erros</span>
      <strong>{{ summary?.totals?.errors || 0 }}</strong>
    </article>
    <article class="summary-card">
      <span>Bloqueados</span>
      <strong>{{ summary?.totals?.blocked || 0 }}</strong>
    </article>
    <article class="summary-card">
      <span>Release</span>
      <strong>6</strong>
    </article>
  </div>
</template>

<script setup>
defineProps({
  summary: {
    type: Object,
    default: () => ({}),
  },
})
</script>

<style scoped>
.summary-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 1rem;
}

.summary-card {
  display: grid;
  gap: 0.35rem;
  padding: 1rem;
}

.summary-card span {
  color: var(--text-muted);
  font-family: var(--font-sans);
  font-size: var(--text-xs);
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: var(--eyebrow-letter-spacing);
}

.summary-card strong {
  color: var(--text-primary);
  font-size: 1.45rem;
}

@media (max-width: 760px) {
  .summary-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}
</style>
