<template>
  <button type="button" data-testid="billing-portal-button" @click="$emit('open')">Gerenciar assinatura</button>
</template>

<script setup>
defineEmits(['open'])
</script>

<style scoped>
button {
  border: 1px solid var(--border-color);
  border-radius: 8px;
  padding: 0.65rem 0.85rem;
  background: var(--bg-input);
  color: var(--text-primary);
  font-weight: 800;
}
</style>
