<template>
  <PageShell
    eyebrow="Planejamento"
    title="Simulações"
    description="Avalie cenários antes de tomar decisões financeiras importantes."
    testid="simulations-page"
  >
    <section class="simulations-grid" aria-label="Simulações disponíveis">
      <router-link class="simulation-card" to="/simulations/can-i-buy" data-testid="simulation-can-i-buy">
        <strong>Posso comprar?</strong>
        <p>Simule o impacto de uma compra sem criar lançamento financeiro.</p>
        <span>Abrir simulação</span>
      </router-link>

      <article class="simulation-card disabled" aria-disabled="true">
        <strong>Cenário mensal</strong>
        <p>Projeções avançadas ficam organizadas aqui quando liberadas para sua conta.</p>
        <span>Premium</span>
      </article>
    </section>
  </PageShell>
</template>

<script setup>
import PageShell from '@/components/layout/PageShell.vue'
</script>

<style scoped>
.simulations-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: 1rem;
}

.simulation-card {
  display: grid;
  gap: 0.65rem;
  min-height: 150px;
  padding: 1rem;
  border: 1px solid var(--divider);
  border-radius: var(--radius-sm);
  background: var(--surface-ledger);
  color: var(--text-primary);
  text-decoration: none;
  box-shadow: none;
}

.simulation-card:hover,
.simulation-card:focus-visible {
  border-color: var(--border-strong);
  background: var(--surface-muted);
}

.simulation-card p {
  margin: 0;
  color: var(--text-secondary);
  line-height: 1.5;
}

.simulation-card span {
  color: var(--accent-hover);
  font-weight: 900;
}

.simulation-card.disabled {
  opacity: 0.72;
}
</style>
