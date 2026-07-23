<template>
  <section class="plan-comparison" data-testid="plan-comparison">
    <article v-for="plan in plans" :key="plan.code" class="plan-card">
      <span>{{ plan.name }}</span>
      <strong>{{ priceLabel(plan) }}</strong>
      <small>{{ detailLabel(plan) }}</small>
      <p>{{ promiseLabel(plan) }}</p>
    </article>
  </section>
</template>

<script setup>
import { publicPlans } from '@/domain/billing/plans.js'

const plans = publicPlans()

function formatMoney(value) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)
}

function priceLabel(plan) {
  if (plan.code === 'premium_annual') return 'R$ 16,58/mês'
  return plan.monthlyPrice ? `${formatMoney(plan.monthlyPrice)}/mês` : 'R$ 0'
}

function detailLabel(plan) {
  if (plan.code === 'free') return 'Controle financeiro simples'
  if (plan.code === 'premium_annual') return 'R$ 199,00 cobrados ao ano'
  return 'Analista financeiro mensal'
}

function promiseLabel(plan) {
  if (plan.code === 'free') return 'Receitas, despesas, contas, cartões e relatório mensal básico.'
  if (plan.code === 'premium_annual') return 'Todos os recursos Premium com melhor custo-benefício.'
  return 'Análises, simulações, alertas e recomendações para decidir melhor.'
}
</script>

<style scoped>
.plan-comparison {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 1rem;
}

.plan-card {
  display: grid;
  gap: 0.45rem;
  padding: 1rem;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  background: var(--bg-panel);
}

.plan-card strong {
  font-size: 1.4rem;
}

.plan-card small,
.plan-card p {
  color: var(--text-muted);
}

.plan-card p {
  margin: 0;
  line-height: 1.45;
}

@media (max-width: 720px) {
  .plan-comparison {
    grid-template-columns: 1fr;
  }
}
</style>
