<template>
  <header class="public-header" data-testid="public-header">
    <router-link to="/" class="public-brand" aria-label="Controle Financeiro">
      <BrandMark />
      <span>Controle Financeiro</span>
    </router-link>

    <nav aria-label="Navegação pública">
      <router-link to="/pricing">Planos</router-link>
      <router-link to="/login">Entrar</router-link>
      <router-link to="/signup" class="primary-link">Criar conta</router-link>
    </nav>
  </header>
</template>

<script setup>
import BrandMark from '@/components/brand/BrandMark.vue'
</script>

<style scoped>
.public-header {
  position: relative;
  z-index: 1;
  width: min(1120px, 100%);
  min-height: 56px;
  margin-inline: auto;
  padding: 0.65rem 0.75rem;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  border: 1px solid var(--public-border, var(--border-color));
  border-radius: var(--radius-sm);
  background: rgba(255, 255, 255, 0.88);
  box-shadow: none;
  backdrop-filter: blur(10px);
}

.public-brand,
nav {
  display: flex;
  align-items: center;
  gap: 0.85rem;
  min-width: 0;
}

.public-brand {
  color: var(--public-text-primary, var(--text-primary));
  text-decoration: none;
  font-weight: 900;
}

.public-brand span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

nav {
  justify-content: flex-end;
  flex-wrap: wrap;
}

a {
  min-height: 38px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-sm);
  padding: 0.45rem 0.65rem;
  color: var(--public-text-secondary, var(--text-secondary));
  text-decoration: none;
  font-weight: 800;
}

.primary-link {
  padding: 0.78rem 1rem;
  background: var(--accent);
  color: #fff;
}

@media (max-width: 520px) {
  .public-header {
    display: grid;
    gap: 0.85rem;
  }

  nav {
    justify-content: start;
    width: 100%;
  }
}

@media (max-width: 390px) {
  .public-brand span {
    max-width: 190px;
  }

  nav {
    gap: 0.55rem;
  }

  .primary-link {
    padding-inline: 0.82rem;
  }
}
</style>
