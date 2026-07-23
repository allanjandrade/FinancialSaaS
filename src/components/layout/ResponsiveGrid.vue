<template>
  <section class="responsive-grid" :class="variant">
    <slot />
  </section>
</template>

<script setup>
defineProps({
  variant: {
    type: String,
    default: 'sections',
    validator: (value) => ['kpis', 'sections', 'actions'].includes(value),
  },
})
</script>

<style scoped>
.responsive-grid {
  display: grid;
  gap: 1rem;
  align-items: stretch;
}

.responsive-grid.kpis {
  grid-template-columns: repeat(4, minmax(0, 1fr));
}

.responsive-grid.sections {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.responsive-grid.actions {
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
}

:slotted(*) {
  min-width: 0;
}

@media (max-width: 1024px) {
  .responsive-grid.kpis {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 768px) {
  .responsive-grid.sections {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 520px) {
  .responsive-grid.kpis,
  .responsive-grid.actions {
    grid-template-columns: 1fr;
  }
}
</style>
