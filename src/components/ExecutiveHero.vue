<template>
  <section class="executive-hero" :class="summary.risk" data-testid="executive-hero">
    <div class="hero-main">
      <p class="eyebrow">Como estou agora?</p>
      <h1 v-if="summary.needsIncomeSetup">Cadastre sua primeira receita para calcularmos sua capacidade segura de gastos.</h1>
      <h1 v-else>Você pode gastar {{ formatCurrency(summary.safeToSpend) }} com segurança até o fim do mês.</h1>
      <div class="hero-status">
        <span>{{ summary.status }}</span>
        <p>{{ summary.mainRisk }}</p>
      </div>
    </div>
    <aside class="next-action">
      <span>Próxima melhor ação</span>
      <strong>{{ summary.nextAction }}</strong>
      <button
        v-if="isIncomeAction"
        class="primary-button"
        type="button"
        data-testid="hero-review-action"
        @click="emit('focus-quick-income')"
      >
        Revisar agora
      </button>
      <router-link v-else class="primary-button" :to="actionTo">Revisar agora</router-link>
    </aside>
  </section>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  summary: { type: Object, required: true },
})

const emit = defineEmits(['focus-quick-income'])

const isIncomeAction = computed(() => String(props.summary.nextAction || '').toLowerCase().includes('receita'))

const actionTo = computed(() => {
  const text = String(props.summary.nextAction || '').toLowerCase()
  if (text.includes('cartão') || text.includes('cartao')) return '/card'
  if (text.includes('receita') || text.includes('despesa')) return '/entries'
  return '/dashboard'
})

function formatCurrency(value) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value || 0))
}
</script>

<style scoped>
.executive-hero {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(240px, 320px);
  gap: 1rem;
  padding: 1rem;
  border: 1px solid var(--divider-strong);
  border-radius: var(--radius-sm);
  background: var(--surface-ledger);
  box-shadow: none;
}
.executive-hero.attention { border-color: rgba(240, 180, 93, 0.42); }
.executive-hero.risk,
.executive-hero.critical { border-color: rgba(240, 120, 85, 0.48); }
.hero-main,
.next-action { display: grid; align-content: center; gap: 0.8rem; }
.eyebrow,
.next-action span {
  margin: 0;
  color: var(--accent);
  font-family: var(--font-sans);
  font-size: var(--text-xs);
  font-weight: 700;
  letter-spacing: var(--eyebrow-letter-spacing);
  text-transform: uppercase;
}
h1 {
  max-width: 780px;
  margin: 0;
  color: var(--text-primary);
  font-family: var(--font-display);
  font-size: var(--page-title-size);
  font-weight: var(--page-title-weight);
  line-height: var(--page-title-line-height);
  letter-spacing: 0;
}
.hero-status {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.65rem;
}
.hero-status span {
  padding: 0.35rem 0.65rem;
  border-radius: var(--radius-sm);
  background: var(--blue-dim);
  color: var(--accent);
  font-weight: 800;
  font-size: 0.78rem;
}
.hero-status p { margin: 0; color: var(--text-secondary); }
.next-action {
  padding: 1rem;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  background: var(--bg-elevated);
}
.next-action strong {
  color: var(--text-primary);
  font-size: 1.15rem;
}
.next-action a,
.next-action button {
  width: fit-content;
  text-decoration: none;
}
@media (max-width: 780px) {
  .executive-hero { grid-template-columns: 1fr; }
}
</style>
