<template>
  <main class="demo-dashboard" data-testid="demo-mode">
    <section class="demo-banner">
      <strong>Modo demonstração: estes dados são fictícios e não alteram sua conta.</strong>
      <router-link class="secondary-button" to="/">Sair da demonstração</router-link>
    </section>

    <ExecutiveHero :summary="summary" />

    <section class="demo-grid">
      <article v-for="kpi in summary.kpis" :key="kpi.key" class="demo-kpi">
        <span>{{ kpi.label }}</span>
        <strong>{{ typeof kpi.value === 'number' ? formatCurrency(kpi.value) : kpi.value }}</strong>
      </article>
    </section>

    <section class="demo-grid two">
      <article class="demo-panel">
        <h2>Alertas</h2>
        <p>Preço caiu 12% em um item monitorado.</p>
        <p>Fatura em atenção: revise assinaturas antes do fechamento.</p>
      </article>
      <article class="demo-panel">
        <h2>Copiloto</h2>
        <p>Leitura simulada: você pode reduzir risco revisando gastos no cartão e preservando a reserva.</p>
      </article>
      <article class="demo-panel">
        <h2>Automacoes</h2>
        <p>Alertas simulados, sem envio externo e sem lançamentos automáticos.</p>
      </article>
      <article class="demo-panel">
        <h2>Acoes confirmadas</h2>
        <p>Sugestões aparecem como revisão. Nada é gravado sem confirmação.</p>
      </article>
    </section>
  </main>
</template>

<script setup>
import { computed } from 'vue'
import ExecutiveHero from '@/components/ExecutiveHero.vue'
import { buildDemoFinanceState, buildExecutiveSummary } from '@/utils/release7-ux'

const demoState = buildDemoFinanceState()
const summary = computed(() => buildExecutiveSummary(demoState, calcDemoMonth))

function calcDemoMonth(month) {
  const key = demoState.settings.year * 100 + month
  const monthKey = (date) => {
    const [year, rawMonth] = String(date).split('-').map(Number)
    return year * 100 + rawMonth
  }
  const incomeCash = demoState.incomes
    .filter((item) => monthKey(item.date) === key && item.type !== 'VA' && item.type !== 'VR')
    .reduce((sum, item) => sum + Number(item.amount || 0), 0)
  const vaIncome = demoState.incomes
    .filter((item) => monthKey(item.date) === key && (item.type === 'VA' || item.type === 'VR'))
    .reduce((sum, item) => sum + Number(item.amount || 0), 0)
  const cashExpenses = demoState.expenses
    .filter((item) => monthKey(item.date) === key && item.payment !== 'Credito' && item.payment !== 'VA' && item.payment !== 'VR')
    .reduce((sum, item) => sum + Number(item.amount || 0), 0)
  const cardBill = demoState.expenses
    .filter((item) => monthKey(item.date) === key && item.payment === 'Credito')
    .reduce((sum, item) => sum + Number(item.amount || 0), 0)
  return { incomeCash, vaIncome, cashExpenses, cardBill, vaUse: 260, cashBalance: incomeCash - cashExpenses }
}

function formatCurrency(value) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value || 0))
}
</script>

<style scoped>
.demo-dashboard {
  width: min(var(--content-max), 100%);
  margin: 0 auto;
  padding: var(--content-pad);
  display: grid;
  gap: 1rem;
}
.demo-banner,
.demo-kpi,
.demo-panel {
  border: 1px solid var(--divider);
  border-radius: var(--radius-sm);
  background: var(--surface-ledger);
  box-shadow: none;
}
.demo-banner {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
  padding: 0.9rem 1rem;
}
.demo-banner strong { color: var(--text-primary); }
.demo-banner a { text-decoration: none; }
.demo-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0.85rem;
}
.demo-grid.two { grid-template-columns: repeat(2, minmax(0, 1fr)); }
.demo-kpi,
.demo-panel { padding: 1rem; }
.demo-kpi span {
  display: block;
  color: var(--text-secondary);
  font-size: 0.78rem;
  font-weight: 800;
}
.demo-kpi strong {
  display: block;
  margin-top: 0.35rem;
  color: var(--text-primary);
  font-size: 1.15rem;
}
.demo-panel h2 { margin: 0 0 0.5rem; font-size: 1rem; }
.demo-panel p { margin: 0.35rem 0; color: var(--text-secondary); }
@media (max-width: 760px) {
  .demo-grid,
  .demo-grid.two { grid-template-columns: 1fr; }
  .demo-banner { display: grid; }
}
</style>
