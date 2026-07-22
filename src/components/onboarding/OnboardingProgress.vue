<template>
  <div class="onboarding-progress" aria-label="Progresso da configuração inicial">
    <div class="progress-head">
      <span>Configuração inicial</span>
      <strong>{{ percent }}%</strong>
    </div>
    <div class="progress-track">
      <span :style="{ width: `${percent}%` }" />
    </div>
    <ul>
      <li v-for="item in checks" :key="item.key" :class="{ complete: item.complete }">
        <CheckCircle v-if="item.complete" />
        <Circle v-else />
        {{ item.label }}
      </li>
    </ul>
  </div>
</template>

<script setup>
import { CheckCircle, Circle } from 'lucide-vue-next'

defineProps({
  percent: { type: Number, required: true },
  checks: { type: Array, required: true },
})
</script>

<style scoped>
.onboarding-progress {
  display: grid;
  gap: 0.75rem;
  padding: 1rem;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  background: var(--bg-panel);
}
.progress-head {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  color: var(--text-secondary);
  font-size: 0.86rem;
  font-weight: 800;
}
.progress-head strong { color: var(--accent-hover); }
.progress-track {
  height: 8px;
  overflow: hidden;
  border-radius: 999px;
  background: var(--bg-hover);
}
.progress-track span {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: linear-gradient(90deg, var(--accent), var(--accent-cyan));
}
ul {
  display: grid;
  gap: 0.45rem;
  margin: 0;
  padding: 0;
  list-style: none;
}
li {
  display: flex;
  align-items: center;
  gap: 0.45rem;
  color: var(--text-secondary);
  font-size: 0.82rem;
}
li svg { width: 15px; height: 15px; }
li.complete { color: var(--success); }
</style>
