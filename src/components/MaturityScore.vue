<template>
  <section class="maturity-panel" :class="{ compact }">
    <div class="maturity-head">
      <div>
        <h2>Maturidade financeira</h2>
        <p class="subtitle">
          {{ activeMonthsLabel }} com lançamentos
          <span v-if="maturity.historyCount"> · {{ historyCountLabel }} no histórico</span>
        </p>
      </div>
      <div class="overall-badge" :class="levelClass">
        <span class="overall-value">{{ maturity.overall }}</span>
        <span class="overall-label">{{ maturity.level }}</span>
      </div>
    </div>

    <div class="dimensions">
      <div
        v-for="(label, key) in maturity.labels"
        :key="key"
        class="dimension-row"
      >
        <div class="dimension-meta">
          <span>{{ label }}</span>
          <strong>{{ maturity.dimensions[key] }}/100</strong>
        </div>
        <div class="bar-track">
          <div
            class="bar-fill"
            :style="{ width: `${maturity.dimensions[key]}%` }"
            :class="barClass(maturity.dimensions[key])"
          />
        </div>
      </div>
    </div>

    <p v-if="maturity.trend === 'up'" class="trend up">
      Tendência mensal: subiu
      <span v-if="maturity.previousOverall != null"> de {{ maturity.previousOverall }} para {{ maturity.overall }}</span>.
    </p>
    <p v-else-if="maturity.trend === 'down'" class="trend down">
      Tendência mensal: caiu
      <span v-if="maturity.previousOverall != null"> de {{ maturity.previousOverall }} para {{ maturity.overall }}</span>.
    </p>
    <p v-else class="trend">Histórico mensal atualizado automaticamente a cada alteração nos dados.</p>
  </section>
</template>

<script setup>
import { computed } from 'vue'
import { useFinanceStore } from '@/stores/finance'
import { computeFinancialMaturity } from '@/utils/financial-maturity.js'
import { monthCountLabel, quantityLabel } from '@/utils/pt-br-copy.js'

defineProps({
  compact: { type: Boolean, default: false },
})

const financeStore = useFinanceStore()

const maturity = computed(() =>
  computeFinancialMaturity(financeStore.state, (m) => financeStore.calcMonth(m)),
)

const activeMonthsLabel = computed(() => monthCountLabel(maturity.value.activeMonths))
const historyCountLabel = computed(() => quantityLabel(maturity.value.historyCount, 'registro', 'registros'))

const levelClass = computed(() => {
  const o = maturity.value.overall
  if (o >= 80) return 'excellent'
  if (o >= 65) return 'good'
  if (o >= 50) return 'fair'
  return 'attention'
})

function barClass(score) {
  if (score >= 75) return 'high'
  if (score >= 50) return 'mid'
  return 'low'
}
</script>

<style scoped>
.maturity-panel {
  min-height: 100%;
  background: var(--surface-ledger);
  border: 1px solid var(--divider);
  border-radius: var(--radius-sm);
  padding: 1.35rem;
  box-shadow: none;
}
.maturity-head {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  align-items: flex-start;
  margin-bottom: 1rem;
}
.maturity-head h2 { margin: 0; font-size: var(--text-lg); font-weight: 700; }
.subtitle { margin: 0.25rem 0 0; color: var(--text-secondary); font-size: var(--text-sm); }
.overall-badge {
  text-align: center;
  padding: 0.65rem 0.9rem;
  border: 1px solid currentColor;
  border-radius: var(--radius-md);
  min-width: 96px;
}
.overall-badge.excellent { background: var(--income-dim); color: var(--income); }
.overall-badge.good { background: var(--blue-dim); color: var(--accent-hover); }
.overall-badge.fair { background: var(--savings-dim); color: var(--savings); }
.overall-badge.attention { background: var(--expense-dim); color: var(--expense); }
.overall-value { display: block; font-family: var(--font-mono); font-size: 1.55rem; font-weight: 600; line-height: 1; }
.overall-label { font-size: 0.7rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.04em; }
.dimensions { display: grid; gap: 0.85rem; }
.dimension-meta {
  display: flex;
  justify-content: space-between;
  font-size: var(--text-sm);
  margin-bottom: 0.3rem;
  color: var(--text-primary);
}
.bar-track {
  height: 7px;
  background: var(--bg-elevated);
  border-radius: 999px;
  overflow: hidden;
}
.bar-fill {
  height: 100%;
  border-radius: 999px;
  transition: width 0.4s ease;
}
.bar-fill.high { background: linear-gradient(90deg, var(--income), #65d6b2); }
.bar-fill.mid { background: linear-gradient(90deg, var(--accent), var(--accent-hover)); }
.bar-fill.low { background: linear-gradient(90deg, var(--savings), #f6cf8f); }
.trend { margin: 1rem 0 0; padding-top: 0.8rem; border-top: 1px solid var(--border-color); font-size: var(--text-sm); color: var(--text-secondary); }
.trend.up { color: var(--income); }
.trend.down { color: var(--expense); }
.maturity-panel.compact {
  height: 100%;
  display: flex;
  flex-direction: column;
}
.maturity-panel.compact .dimensions {
  flex: 1;
}
@media (max-width: 640px) {
  .maturity-head { flex-direction: column; }
}
</style>
