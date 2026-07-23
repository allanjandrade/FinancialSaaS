<template>
  <main class="page-shell" :data-testid="testid">
    <PageHeader :eyebrow="eyebrow" :title="title" :description="description">
      <template v-if="$slots.actions" #actions>
        <slot name="actions" />
      </template>
    </PageHeader>
    <slot />
  </main>
</template>

<script setup>
import PageHeader from '@/components/layout/PageHeader.vue'

defineProps({
  eyebrow: { type: String, default: '' },
  title: { type: String, default: '' },
  description: { type: String, default: '' },
  testid: { type: String, default: '' },
})
</script>

<style scoped>
.page-shell {
  width: min(var(--content-max), 100%);
  margin: 0 auto;
  padding: var(--content-pad);
  display: grid;
  align-content: start;
  gap: var(--section-gap);
  overflow-x: hidden;
}

@media (max-width: 620px) {
  .page-shell {
    padding: 0.75rem;
  }
}
</style>
