<template>
  <section class="financial-agenda" data-testid="v33-financial-agenda">
    <header>
      <div>
        <span>Agenda financeira</span>
        <h2>Prioridades do periodo</h2>
      </div>
      <strong>{{ totalItems }}</strong>
    </header>

    <div class="v33-agenda-list">
      <article v-for="group in visibleGroups" :key="group.key" class="agenda-group">
        <h3>{{ group.label }}</h3>
        <button
          v-for="item in group.items"
          :key="item.key"
          class="v33-agenda-item"
          :class="item.priority"
          data-testid="v33-agenda-item"
          type="button"
          @click="emit('run', item)"
        >
          <span>
            <strong>{{ item.title }}</strong>
            <small>{{ item.description }}</small>
          </span>
          <em>{{ item.actionLabel }}</em>
        </button>
      </article>
    </div>
  </section>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  groups: {
    type: Object,
    default: () => ({ today: [], next7: [], month: [], later: [] }),
  },
})

const emit = defineEmits(['run'])

const groupLabels = [
  { key: 'today', label: 'Hoje' },
  { key: 'next7', label: 'Proximos 7 dias' },
  { key: 'month', label: 'Este mes' },
  { key: 'later', label: 'Depois' },
]

const visibleGroups = computed(() => groupLabels
  .map((group) => ({ ...group, items: props.groups[group.key] || [] }))
  .filter((group) => group.items.length))

const totalItems = computed(() => visibleGroups.value.reduce((sum, group) => sum + group.items.length, 0))
</script>

<style scoped>
.financial-agenda {
  border: 1px solid var(--divider);
  border-radius: var(--radius-sm);
  background: var(--surface-ledger);
  overflow: hidden;
}

.financial-agenda header {
  min-height: 70px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 1rem;
  border-bottom: 1px solid var(--border-color);
}

.financial-agenda header span {
  color: var(--accent);
  font-size: var(--text-xs);
  font-weight: 900;
  letter-spacing: var(--eyebrow-letter-spacing);
  text-transform: uppercase;
}

.financial-agenda header h2 {
  margin: 0.12rem 0 0;
  font-size: 1.05rem;
}

.financial-agenda header strong {
  color: var(--accent);
  font-size: 1.6rem;
}

.v33-agenda-list {
  display: grid;
  gap: 0.85rem;
  padding: 1rem;
}

.agenda-group {
  display: grid;
  gap: 0.5rem;
}

.agenda-group h3 {
  margin: 0;
  color: var(--text-secondary);
  font-size: 0.78rem;
  text-transform: uppercase;
  letter-spacing: var(--eyebrow-letter-spacing);
}

.v33-agenda-item {
  width: 100%;
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 0.8rem;
  align-items: center;
  border: 1px solid var(--border-color);
  border-left: 3px solid var(--accent);
  border-radius: 10px;
  background: var(--bg-elevated);
  color: inherit;
  padding: 0.8rem;
  text-align: left;
  cursor: pointer;
}

.v33-agenda-item.critical {
  border-left-color: var(--expense);
}

.v33-agenda-item.high {
  border-left-color: var(--warning);
}

.v33-agenda-item span {
  min-width: 0;
  display: grid;
  gap: 0.2rem;
}

.v33-agenda-item small {
  color: var(--text-secondary);
  line-height: 1.45;
}

.v33-agenda-item em {
  border-radius: 999px;
  background: var(--blue-dim);
  color: var(--accent);
  padding: 0.32rem 0.6rem;
  font-size: 0.72rem;
  font-style: normal;
  font-weight: 900;
  white-space: nowrap;
}

@media (max-width: 640px) {
  .v33-agenda-item {
    grid-template-columns: 1fr;
  }

  .v33-agenda-item em {
    justify-self: start;
  }
}
</style>
