<template>
  <article class="paywall-card" data-testid="paywall-card">
    <strong>Você atingiu o limite do plano grátis.</strong>
    <p>O Premium transforma seu controle financeiro em uma análise completa, com simulações, recomendações e limites ampliados.</p>
    <button type="button" @click="$emit('notify')">Fazer upgrade</button>
  </article>
</template>

<script setup>
defineEmits(['notify'])
</script>

<style scoped>
.paywall-card {
  display: grid;
  gap: 0.7rem;
  padding: 1rem;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  background: var(--bg-panel);
}

.paywall-card p {
  margin: 0;
  color: var(--text-secondary);
}

button {
  width: fit-content;
  border: 0;
  border-radius: 8px;
  padding: 0.7rem 1rem;
  background: var(--accent);
  color: white;
  font-weight: 800;
}
</style>
