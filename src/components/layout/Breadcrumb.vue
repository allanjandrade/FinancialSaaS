<template>
  <nav v-if="items.length" class="breadcrumb" aria-label="Caminho da página" data-testid="breadcrumb">
    <ol>
      <li v-for="(item, index) in items" :key="`${item}-${index}`">
        <span v-if="index === items.length - 1" aria-current="page">{{ item }}</span>
        <span v-else>{{ item }}</span>
      </li>
    </ol>
  </nav>
</template>

<script setup>
defineProps({
  items: {
    type: Array,
    default: () => [],
  },
})
</script>

<style scoped>
.breadcrumb {
  width: min(var(--content-max), 100%);
  margin: 0 auto;
  padding: 0.75rem var(--content-pad) 0;
}

.breadcrumb ol {
  margin: 0;
  padding: 0;
  display: flex;
  align-items: center;
  gap: 0.4rem;
  list-style: none;
  color: var(--text-muted);
  font-family: var(--font-sans);
  font-size: var(--text-xs);
  font-weight: 700;
  letter-spacing: var(--eyebrow-letter-spacing);
}

.breadcrumb li {
  min-width: 0;
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
}

.breadcrumb li:not(:last-child)::after {
  content: '>';
  color: var(--text-muted);
  opacity: 0.7;
}

.breadcrumb [aria-current='page'] {
  color: var(--text-primary);
}

@media (max-width: 768px) {
  .breadcrumb {
    padding: 0.55rem 0.75rem 0;
  }

  .breadcrumb ol {
    overflow-x: auto;
    white-space: nowrap;
  }
}
</style>
