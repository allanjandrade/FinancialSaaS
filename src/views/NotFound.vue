<template>
  <main class="not-found" aria-labelledby="not-found-title">
    <section class="not-found-card">
      <p class="code">404</p>
      <h1 id="not-found-title">Página não encontrada</h1>
      <p>O endereço informado não existe ou foi movido.</p>
      <RouterLink to="/">Voltar ao início</RouterLink>
    </section>
  </main>
</template>

<script setup>
import { RouterLink } from 'vue-router'
</script>

<style scoped>
.not-found {
  min-height: 60vh;
  display: grid;
  place-content: center;
  padding: 2rem;
}
.not-found-card {
  display: grid;
  justify-items: center;
  gap: 0.75rem;
  width: min(520px, 100%);
  padding: clamp(1.25rem, 4vw, 2rem);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-lg);
  background: var(--surface-ledger);
  box-shadow: none;
  text-align: center;
}
.code { margin: 0; color: var(--accent); font: 700 3rem/1 var(--font-mono); }
h1, p { margin: 0; }
p { color: var(--text-secondary); }
a { color: var(--accent); font-weight: 700; }
</style>
