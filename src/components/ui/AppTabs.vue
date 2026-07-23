<template>
  <nav class="app-tabs" role="tablist" :aria-label="ariaLabel">
    <button
      v-for="tab in tabs"
      :key="tab.id"
      type="button"
      role="tab"
      class="app-tabs__tab touch-target"
      :class="{ 'app-tabs__tab--active': modelValue === tab.id }"
      :aria-selected="modelValue === tab.id"
      @click="selectTab(tab.id)"
    >
      <span>{{ tab.label }}</span>
      <strong v-if="showCounts && countFor(tab.id) !== null">{{ countFor(tab.id) }}</strong>
    </button>
  </nav>
</template>

<script setup>
const props = defineProps({
  tabs: { type: Array, default: () => [] },
  modelValue: { type: String, default: '' },
  counts: { type: Object, default: () => ({}) },
  showCounts: { type: Boolean, default: true },
  ariaLabel: { type: String, default: 'Navegação por abas' },
})

const emit = defineEmits(['update:modelValue'])

function countFor(id) {
  if (!(id in props.counts)) return null
  const count = Number(props.counts[id] || 0)
  return Number.isFinite(count) ? count : 0
}

function selectTab(id) {
  emit('update:modelValue', id)
}
</script>

<style scoped>
.app-tabs {
  display: flex;
  align-items: stretch;
  gap: 0.35rem;
  min-width: 0;
  max-width: 100%;
  overflow-x: auto;
  border-bottom: 1px solid var(--border-color);
  background: transparent;
  scrollbar-width: thin;
}

.app-tabs__tab {
  position: relative;
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  flex: 0 0 auto;
  min-height: var(--touch-target-min);
  padding: 0.55rem 0.85rem;
  border: none;
  border-radius: 0;
  background: transparent;
  color: var(--text-secondary);
  font-size: var(--text-sm);
  font-weight: 600;
  cursor: pointer;
  white-space: nowrap;
  transition: color 0.15s ease;
}

.app-tabs__tab::after {
  content: '';
  position: absolute;
  left: 0.5rem;
  right: 0.5rem;
  bottom: -1px;
  height: 3px;
  border-radius: 2px 2px 0 0;
  background: transparent;
  transition: background 0.15s ease;
}

.app-tabs__tab:hover {
  color: var(--text-primary);
}

.app-tabs__tab--active {
  color: var(--text-primary);
}

.app-tabs__tab--active::after {
  background: var(--accent-purple);
}

.app-tabs__tab strong {
  display: inline-grid;
  place-items: center;
  min-width: 1.25rem;
  height: 1.25rem;
  padding: 0 0.35rem;
  border-radius: var(--radius-pill);
  background: var(--bg-elevated);
  color: var(--text-primary);
  font-size: 0.68rem;
  font-weight: 800;
}
</style>
