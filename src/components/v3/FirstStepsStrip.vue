<template>
  <section class="first-steps" data-testid="v33-first-steps">
    <header>
      <span>Primeiros passos</span>
      <strong>{{ doneCount }}/{{ steps.length }}</strong>
    </header>

    <div class="first-steps__rail">
      <button
        v-for="step in steps"
        :key="step.key"
        type="button"
        :disabled="step.status === 'locked'"
        :class="step.status"
        @click="emit('run', step)"
      >
        <i />
        <span>{{ step.label }}</span>
      </button>
    </div>
  </section>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  steps: { type: Array, default: () => [] },
})

const emit = defineEmits(['run'])

const doneCount = computed(() => props.steps.filter((step) => step.status === 'done').length)
</script>

<style scoped>
.first-steps {
  display: grid;
  gap: 0.75rem;
  border: 1px solid var(--divider);
  border-radius: var(--radius-sm);
  background: var(--surface-ledger);
  padding: 1rem;
}

.first-steps header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
}

.first-steps header span {
  color: var(--accent);
  font-size: var(--text-xs);
  font-weight: 900;
  letter-spacing: var(--eyebrow-letter-spacing);
  text-transform: uppercase;
}

.first-steps header strong {
  color: var(--text-primary);
}

.first-steps__rail {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 0.55rem;
}

.first-steps__rail button {
  min-height: 48px;
  display: flex;
  align-items: center;
  gap: 0.45rem;
  border: 1px solid var(--border-color);
  border-radius: 999px;
  background: var(--bg-elevated);
  color: var(--text-secondary);
  padding: 0.45rem 0.7rem;
  cursor: pointer;
}

.first-steps__rail button:disabled {
  cursor: not-allowed;
  opacity: 0.55;
}

.first-steps__rail button.current {
  border-color: color-mix(in srgb, var(--accent) 40%, var(--border-color));
  color: var(--accent);
}

.first-steps__rail button.done {
  border-color: color-mix(in srgb, var(--income) 40%, var(--border-color));
  color: var(--income);
}

.first-steps__rail i {
  width: 9px;
  height: 9px;
  border-radius: 999px;
  background: currentColor;
}

@media (max-width: 760px) {
  .first-steps__rail {
    grid-template-columns: 1fr;
  }
}
</style>
