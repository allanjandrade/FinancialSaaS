<template>
  <section class="completion-card">
    <div class="completion-icon"><CheckCircle /></div>
    <h2>Seu financeiro inicial está pronto.</h2>
    <p>Agora o app já consegue estimar saldo seguro, risco do cartão e próximos alertas.</p>
    <div class="completion-actions">
      <router-link class="primary-button" to="/">Ir para Dashboard</router-link>
      <router-link class="secondary-button" to="/entries">Cadastrar primeiro lançamento</router-link>
    </div>
  </section>
</template>

<script setup>
import { CheckCircle } from 'lucide-vue-next'
</script>

<style scoped>
.completion-card {
  display: grid;
  justify-items: start;
  gap: 0.85rem;
  padding: 1.25rem;
  border: 1px solid rgba(49, 189, 145, 0.28);
  border-radius: 8px;
  background: rgba(49, 189, 145, 0.08);
}
.completion-icon {
  width: 46px;
  height: 46px;
  display: grid;
  place-items: center;
  border-radius: 12px;
  color: var(--success);
  background: var(--income-dim);
}
.completion-icon svg { width: 24px; height: 24px; }
h2 { margin: 0; color: var(--text-primary); }
p { margin: 0; color: var(--text-secondary); }
.completion-actions { display: flex; flex-wrap: wrap; gap: 0.65rem; }
.completion-actions a { text-decoration: none; }
</style>
