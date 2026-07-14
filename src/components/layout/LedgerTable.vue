<template>
  <section class="ledger-table" :data-testid="testid || undefined">
    <header v-if="$slots.header || title" class="ledger-table__header">
      <slot name="header">
        <h2>{{ title }}</h2>
      </slot>
    </header>
    <div class="ledger-table__body">
      <slot />
    </div>
  </section>
</template>

<script setup>
defineProps({
  title: { type: String, default: '' },
  testid: { type: String, default: '' },
})
</script>

<style scoped>
.ledger-table {
  min-width: 0;
  display: grid;
  border-top: 1px solid var(--divider);
  background: transparent;
}

.ledger-table__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 0.75rem 0;
  border-bottom: 1px solid var(--divider-strong);
}

.ledger-table h2 {
  margin: 0;
  color: var(--text-primary);
  font-size: var(--text-lg);
  line-height: 1.25;
}

.ledger-table__body {
  display: grid;
  min-width: 0;
}

:deep(.ledger-row),
:deep(tr) {
  border-bottom: 1px solid var(--divider);
}
</style>
