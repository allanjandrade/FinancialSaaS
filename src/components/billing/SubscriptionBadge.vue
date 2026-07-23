<template>
  <span class="subscription-badge" data-testid="subscription-badge">{{ label }}</span>
</template>

<script setup>
defineProps({ label: { type: String, default: 'Plano grátis' } })
</script>

<style scoped>
.subscription-badge {
  display: inline-flex;
  width: fit-content;
  border-radius: 999px;
  padding: 0.35rem 0.65rem;
  background: var(--blue-dim);
  color: var(--accent-hover);
  font-size: 0.78rem;
  font-weight: 800;
}
</style>
