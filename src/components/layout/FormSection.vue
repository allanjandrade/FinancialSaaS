<template>
  <section class="form-section" :class="`form-section--cols-${columns}`">
    <header class="form-section__header">
      <h3>{{ title }}</h3>
      <p v-if="description">{{ description }}</p>
    </header>
    <div class="form-section__grid">
      <slot />
    </div>
  </section>
</template>

<script setup>
defineProps({
  title: { type: String, required: true },
  description: { type: String, default: '' },
  columns: { type: Number, default: 2 },
})
</script>

<style scoped>
.form-section {
  display: grid;
  gap: 0.7rem;
  min-width: 0;
  padding: 0.85rem;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-lg);
  background: color-mix(in srgb, var(--bg-hover) 42%, transparent);
}

.form-section__header h3,
.form-section__header p {
  margin: 0;
}

.form-section__header h3 {
  color: var(--text-primary);
  font-family: var(--font-sans);
  font-size: var(--text-sm);
  font-weight: 700;
}

.form-section__header p {
  margin-top: 0.22rem;
  color: var(--text-secondary);
  font-size: var(--text-xs);
  line-height: 1.45;
}

.form-section__grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.65rem;
}

.form-section--cols-3 .form-section__grid {
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.form-section--cols-2 .form-section__grid {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

:slotted(label),
:slotted(.checkbox-inline) {
  min-width: 0;
}

:slotted(.full) {
  grid-column: 1 / -1;
}

@media (max-width: 720px) {
  .form-section__grid,
  .form-section--cols-2 .form-section__grid,
  .form-section--cols-3 .form-section__grid {
    grid-template-columns: 1fr;
  }
}
</style>
