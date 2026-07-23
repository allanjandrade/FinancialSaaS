<template>
  <main class="legal-page" :data-testid="testid">
    <AuthBackground />
    <div class="legal-shell">
      <router-link to="/" class="back-link">Controle Financeiro</router-link>
      <article class="legal-card">
      <p class="eyebrow">Pacote legal - versão 2026-06-20-r11.2</p>
      <h1>{{ title }}</h1>
      <p class="lead">{{ lead }}</p>
        <slot />
      </article>
    </div>
  </main>
</template>

<script setup>
import AuthBackground from '@/components/brand/AuthBackground.vue'

defineProps({
  title: { type: String, required: true },
  lead: { type: String, required: true },
  testid: { type: String, required: true },
})
</script>

<style scoped>
.legal-page {
  --public-page-bg: #f8fafc;
  --public-surface: #ffffff;
  --public-text-primary: #0f172a;
  --public-text-secondary: #475569;
  --public-border: #e2e8f0;
  --auth-background: var(--public-page-bg);
  --auth-grid-line: rgba(15, 23, 42, .04);
  position: relative;
  min-height: 100vh;
  padding: 1.25rem;
  background: var(--public-page-bg);
  color: var(--public-text-primary);
}

.legal-shell {
  position: relative;
  z-index: 1;
  width: min(920px, 100%);
  margin-inline: auto;
}

.back-link {
  display: block;
  margin-bottom: 1rem;
  color: var(--accent);
  font-weight: 900;
  text-decoration: none;
}

.legal-card {
  display: grid;
  gap: 1rem;
  padding: 1.5rem;
  border: 1px solid var(--public-border);
  border-radius: var(--radius-sm);
  background: var(--public-surface);
  box-shadow: none;
}

.eyebrow {
  margin: 0;
  color: var(--accent);
  font-size: .82rem;
  font-weight: 900;
  text-transform: uppercase;
}

h1, .lead { margin: 0; }
h1 { font-size: var(--page-title-size); line-height: var(--page-title-line-height); }
.lead, :deep(p), :deep(li) { color: var(--public-text-secondary); line-height: 1.7; }
:deep(h2) { margin: 1rem 0 0; color: var(--public-text-primary); }
:deep(ul) { padding-left: 1.2rem; }
</style>
