<template>
  <section class="evolution-panel">
    <div class="panel-head">
      <h2>Evolução da maturidade</h2>
      <span v-if="currentOverall != null" class="current-pill">{{ currentOverall }}/100</span>
    </div>
    <p v-if="!hasHistory" class="empty">O histórico mensal será preenchido automaticamente conforme você usa o app.</p>
    <div v-else class="chart-wrap">
      <canvas ref="chartCanvas"></canvas>
    </div>
  </section>
</template>

<script setup>
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue'
import Chart from 'chart.js/auto'
import { useFinanceStore } from '@/stores/finance'
import { computeFinancialMaturity, getMaturityChartSeries } from '@/utils/financial-maturity.js'

const financeStore = useFinanceStore()
const chartCanvas = ref(null)
let chartInstance = null

const series = computed(() =>
  getMaturityChartSeries(financeStore.state.settings.maturityHistory || []),
)

const hasHistory = computed(() => series.value.length > 0)

const currentOverall = computed(() => {
  const m = computeFinancialMaturity(financeStore.state, (month) => financeStore.calcMonth(month))
  return m.overall
})

function renderChart() {
  if (!chartCanvas.value || !hasHistory.value) return

  if (chartInstance) chartInstance.destroy()

  const labels = series.value.map((s) => s.label)
  const overallData = series.value.map((s) => s.overall)
  const rootStyles = getComputedStyle(document.documentElement)
  const accent = rootStyles.getPropertyValue('--accent').trim()
  const accentFill = rootStyles.getPropertyValue('--blue-dim').trim()
  const income = rootStyles.getPropertyValue('--income').trim()
  const savings = rootStyles.getPropertyValue('--savings').trim()
  const grid = rootStyles.getPropertyValue('--border-color').trim()
  const text = rootStyles.getPropertyValue('--text-muted').trim()
  const fontFamily = rootStyles.getPropertyValue('--font-sans').trim()

  Chart.defaults.color = text
  Chart.defaults.font.family = fontFamily

  chartInstance = new Chart(chartCanvas.value, {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label: 'Pontuação geral',
          data: overallData,
          borderColor: accent,
          backgroundColor: accentFill,
          fill: true,
          tension: 0.35,
          pointRadius: 4,
          pointHoverRadius: 6,
        },
        {
          label: 'Controle de gastos',
          data: series.value.map((s) => s.spendingControl),
          borderColor: income,
          borderDash: [4, 4],
          tension: 0.3,
          pointRadius: 0,
        },
        {
          label: 'Reserva',
          data: series.value.map((s) => s.emergencyReserve),
          borderColor: savings,
          borderDash: [4, 4],
          tension: 0.3,
          pointRadius: 0,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: {
          position: 'bottom',
          labels: { usePointStyle: true, padding: 16, color: text, font: { family: fontFamily, size: 11 } },
        },
      },
      scales: {
        y: {
          min: 0,
          max: 100,
          grid: { color: grid, drawBorder: false },
          ticks: { stepSize: 20, padding: 8 },
        },
        x: { grid: { display: false }, ticks: { padding: 8 } },
      },
    },
  })
}

watch(
  () => financeStore.state.settings.maturityHistory,
  async () => {
    await nextTick()
    renderChart()
  },
  { deep: true },
)

onMounted(async () => {
  await nextTick()
  renderChart()
})

onUnmounted(() => {
  if (chartInstance) chartInstance.destroy()
})
</script>

<style scoped>
.evolution-panel {
  min-height: 100%;
  background: var(--surface-ledger);
  border: 1px solid var(--divider);
  border-radius: var(--radius-sm);
  padding: 1.35rem;
  box-shadow: none;
}
.panel-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 1rem;
}
.panel-head h2 {
  margin: 0;
  font-size: var(--text-lg);
  font-weight: 700;
  color: var(--text-primary);
}
.current-pill {
  font-family: var(--font-mono);
  font-size: var(--text-xs);
  font-weight: 700;
  padding: 0.25rem 0.65rem;
  border-radius: var(--radius-sm);
  border: 1px solid color-mix(in srgb, var(--accent) 30%, transparent);
  background: var(--blue-dim);
  color: var(--accent);
}
.chart-wrap {
  height: 280px;
  position: relative;
}
.empty {
  min-height: 280px;
  margin: 0;
  display: grid;
  place-items: center;
  text-align: center;
  color: var(--text-secondary);
  font-size: var(--text-sm);
}
</style>
