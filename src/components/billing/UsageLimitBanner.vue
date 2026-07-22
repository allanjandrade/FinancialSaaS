<template>
  <div class="usage-limit-banner" data-testid="usage-limit-banner">
    <strong>{{ title }}</strong>
    <span>{{ detail }}</span>
  </div>
</template>

<script setup>
defineProps({
  title: { type: String, default: 'Uso do plano' },
  detail: { type: String, default: 'Limites preservam custo e estabilidade.' },
})
</script>

<style scoped>
.usage-limit-banner {
  display: grid;
  gap: 0.2rem;
  padding: 0.85rem;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  background: var(--bg-elevated);
}

span {
  color: var(--text-secondary);
}
</style>
