<template>
  <div class="event-list" data-testid="operational-events">
    <p v-if="!events.length" class="empty">Nada exige atenção neste período.</p>
    <article v-for="event in events" :key="event.id" class="event-row" :class="event.severity">
      <div>
        <strong>{{ event.event_type }}</strong>
        <small>{{ event.source }} · {{ event.status }} · {{ formatDate(event.created_at) }}</small>
        <p v-if="event.error_message">{{ event.error_message }}</p>
      </div>
      <span class="status-pill">{{ event.severity }}</span>
    </article>
  </div>
</template>

<script setup>
defineProps({
  events: {
    type: Array,
    default: () => [],
  },
})

function formatDate(value) {
  if (!value) return 'sem data'
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value))
}
</script>

<style scoped>
.event-list {
  display: grid;
  gap: 0.7rem;
}

.event-row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
  padding: 0.85rem;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  background: var(--bg-hover);
}

.event-row strong {
  color: var(--text-primary);
}

.event-row small,
.event-row p,
.empty {
  color: var(--text-secondary);
}

.event-row.error,
.event-row.critical {
  border-color: rgba(240, 120, 85, 0.36);
}
</style>
