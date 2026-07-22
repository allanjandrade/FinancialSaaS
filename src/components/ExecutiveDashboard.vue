<template>
  <section class="executive-panel">
    <div class="panel-head">
      <h2>Dashboard executivo</h2>
      <span class="month-tag">{{ monthLabel }}</span>
    </div>

    <div class="kpi-grid">
      <div v-for="item in executiveKpis" :key="item.label" class="kpi" :class="item.tone">
        <div class="kpi-top">
          <span class="kpi-label">{{ item.label }}</span>
          <span class="kpi-icon"><component :is="item.icon" /></span>
        </div>
        <strong data-money>{{ formatCurrency(item.value) }}</strong>
        <small>{{ item.context }}</small>
      </div>
    </div>

    <div class="cashflow-row">
      <div class="cashflow-card">
        <h3>Fluxo de caixa real</h3>
        <p>Dinheiro disponível: <strong>{{ formatCurrency(cashFlow.availableCash) }}</strong></p>
        <p>Benefícios: <strong>{{ formatCurrency(cashFlow.benefits) }}</strong></p>
        <p>Limites de crédito: <strong>{{ formatCurrency(cashFlow.creditLimits) }}</strong></p>
        <p>Investimentos: <strong>{{ formatCurrency(cashFlow.investments) }}</strong></p>
        <p class="note">{{ cashFlow.note }}</p>
      </div>
      <div class="cashflow-card">
        <h3>Patrimônio consolidado</h3>
        <ul>
          <li v-for="row in patrimony.sections" :key="row.label">
            <span>{{ row.label }}</span>
            <strong>{{ formatCurrency(row.value) }}</strong>
          </li>
        </ul>
      </div>
    </div>

    <div v-if="familyCenter.length" class="family-block">
      <h3>Centro financeiro familiar</h3>
      <table>
        <thead>
          <tr>
            <th>Membro</th>
            <th>Receita</th>
            <th>VA</th>
            <th>VR</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in familyCenter" :key="row.memberId">
            <td>{{ row.name }}</td>
            <td>{{ formatCurrency(row.incomeTotal) }}</td>
            <td>{{ formatCurrency(row.vaBalance) }}</td>
            <td>{{ formatCurrency(row.vrBalance) }}</td>
          </tr>
          <tr class="total-row">
            <td>Total</td>
            <td>{{ formatCurrency(familyTotals.income) }}</td>
            <td>{{ formatCurrency(familyTotals.va) }}</td>
            <td>{{ formatCurrency(familyTotals.vr) }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>
</template>

<script setup>
import { computed } from 'vue'
import { useFinanceStore } from '@/stores/finance'
import {
  computeConsolidatedPatrimony,
  computeRealCashFlow,
  computeFamilyFinancialCenter,
} from '@/utils/financial-consolidation.js'
import {
  ArrowDownRight,
  ArrowUpRight,
  Building2,
  Coffee,
  CreditCard,
  Landmark,
  ShieldCheck,
  Utensils,
} from 'lucide-vue-next'

const financeStore = useFinanceStore()

const month = computed(() => financeStore.state.settings.selectedMonth)
const monthLabel = computed(() => financeStore.monthNames[month.value - 1])

const monthCalc = computed(() => financeStore.calcMonth(month.value))

const patrimony = computed(() =>
  computeConsolidatedPatrimony(financeStore.state, monthCalc.value),
)

const cashFlow = computed(() =>
  computeRealCashFlow(financeStore.state, monthCalc.value),
)

const familyCenter = computed(() =>
  computeFamilyFinancialCenter(financeStore.state, month.value),
)

const familyTotals = computed(() => ({
  income: familyCenter.value.reduce((s, r) => s + r.incomeTotal, 0),
  va: familyCenter.value.reduce((s, r) => s + r.vaBalance, 0),
  vr: familyCenter.value.reduce((s, r) => s + r.vrBalance, 0),
}))

const monthIncome = computed(
  () => monthCalc.value.incomeCash + monthCalc.value.vaIncome,
)

const monthExpense = computed(
  () => monthCalc.value.cashExpenses + monthCalc.value.cardBill,
)

const executiveKpis = computed(() => [
  { label: 'Saldo bancário', value: patrimony.value.bankBalance, icon: Building2, context: 'Disponível em contas' },
  { label: 'Saldo VA', value: patrimony.value.vaBalance, icon: Utensils, context: 'Vale alimentação' },
  { label: 'Saldo VR', value: patrimony.value.vrBalance, icon: Coffee, context: 'Vale refeição' },
  { label: 'Limite disponível', value: patrimony.value.cardAvailable, icon: CreditCard, context: 'Crédito ainda livre' },
  { label: 'Receita do mês', value: monthIncome.value, icon: ArrowUpRight, context: monthLabel.value, tone: 'positive' },
  { label: 'Despesas do mês', value: monthExpense.value, icon: ArrowDownRight, context: monthLabel.value, tone: 'negative' },
  { label: 'Patrimônio líquido', value: patrimony.value.netPatrimony, icon: Landmark, context: 'Posição consolidada' },
  { label: 'Reserva de emergência', value: patrimony.value.emergencyReserve, icon: ShieldCheck, context: 'Proteção financeira' },
])

function formatCurrency(value) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0)
}
</script>

<style scoped>
.executive-panel {
  position: relative;
  background: var(--surface-ledger);
  border: 1px solid var(--divider);
  border-radius: var(--radius-sm);
  padding: 1rem;
  box-shadow: none;
}
.panel-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.25rem;
}
.panel-head h2 { margin: 0; font-size: var(--text-lg); font-weight: 700; }
.month-tag {
  font-size: var(--text-xs);
  padding: 0.25rem 0.6rem;
  border-radius: 999px;
  background: var(--bg-hover);
  color: var(--text-secondary);
}
.kpi-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  grid-auto-rows: 1fr;
  gap: 0.75rem;
  margin-bottom: 1.25rem;
}
.kpi {
  min-height: 116px;
  height: 100%;
  padding: 0.9rem 1rem;
  display: grid;
  grid-template-rows: auto 1fr auto;
  gap: 0.55rem;
  background: var(--bg-elevated);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
}
.kpi-top { display: flex; justify-content: space-between; align-items: center; gap: 0.75rem; }
.kpi-label { display: block; font-size: var(--text-xs); font-weight: 700; color: var(--text-secondary); }
.kpi-icon { width: 30px; height: 30px; display: grid; place-items: center; border-radius: var(--radius-sm); color: var(--accent); background: var(--blue-dim); }
.kpi-icon svg { width: 15px; }
.kpi strong { align-self: center; font-size: 1.05rem; font-weight: 600; color: var(--text-primary); letter-spacing: 0; }
.kpi small { color: var(--text-muted); font-size: 0.68rem; }
.kpi.positive .kpi-icon { color: var(--income); background: var(--income-dim); }
.kpi.negative .kpi-icon { color: var(--expense); background: var(--expense-dim); }
.kpi.positive strong { color: var(--income); }
.kpi.negative strong { color: var(--expense); }
.cashflow-row {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
  gap: 1rem;
  margin-bottom: 1rem;
}
.cashflow-card {
  min-height: 196px;
  background: var(--bg-elevated);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  padding: 1.1rem;
}
.cashflow-card h3 { margin: 0 0 0.75rem; font-size: var(--text-base); font-weight: 700; }
.cashflow-card p { margin: 0.25rem 0; font-size: 0.88rem; color: var(--text-secondary); }
.cashflow-card ul { list-style: none; margin: 0; padding: 0; }
.cashflow-card li {
  display: flex;
  justify-content: space-between;
  padding: 0.35rem 0;
  font-size: 0.88rem;
  border-bottom: 1px solid var(--border-color);
}
.note { font-size: 0.78rem; margin-top: 0.5rem; }
.family-block h3 { margin: 0 0 0.6rem; font-size: 0.95rem; }
table { width: 100%; border-collapse: collapse; font-size: 0.88rem; }
th, td { padding: 0.5rem; text-align: left; border-bottom: 1px solid var(--border-color); }
.total-row { font-weight: 700; }

@media (max-width: 1100px) {
  .kpi-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}

@media (max-width: 620px) {
  .kpi-grid, .cashflow-row { grid-template-columns: 1fr; }
}
</style>
