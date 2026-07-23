<template>
  <section class="next-best-action" data-testid="v33-next-best-action">
    <div class="next-best-action__copy">
      <span>Melhor proxima acao</span>
      <h2>{{ action?.title || 'Complete a base financeira' }}</h2>
      <p>{{ action?.description || 'Cadastre receita, primeira despesa e meta para ativar recomendacoes confiaveis.' }}</p>
    </div>

    <div class="next-best-action__side">
      <button class="primary-button" type="button" @click="emit('run', action)">
        {{ action?.actionLabel || 'Comecar agora' }}
        <ArrowRight />
      </button>
      <div v-if="blockers.length" class="next-best-action__blockers">
        <strong>Dados pendentes</strong>
        <button v-for="blocker in blockers" :key="blocker.key" type="button" @click="emit('run', blocker)">
          {{ blocker.title }}
        </button>
      </div>
    </div>
  </section>
</template>

<script setup>
import { ArrowRight } from 'lucide-vue-next'

defineProps({
  action: { type: Object, default: null },
  blockers: { type: Array, default: () => [] },
})

const emit = defineEmits(['run'])
</script>

<style scoped>
.next-best-action {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(220px, auto);
  gap: 1rem;
  align-items: center;
  border: 1px solid var(--divider-strong);
  border-radius: var(--radius-sm);
  background: var(--surface-ledger);
  padding: clamp(1rem, 2vw, 1.35rem);
}

.next-best-action__copy {
  display: grid;
  gap: 0.35rem;
}

.next-best-action__copy span,
.next-best-action__blockers strong {
  color: var(--accent);
  font-size: var(--text-xs);
  font-weight: 900;
  letter-spacing: var(--eyebrow-letter-spacing);
  text-transform: uppercase;
}

.next-best-action__copy h2 {
  margin: 0;
  font-size: clamp(1.25rem, 2.5vw, 1.75rem);
}

.next-best-action__copy p {
  max-width: 820px;
  margin: 0;
  color: var(--text-secondary);
  line-height: 1.55;
}

.next-best-action__side {
  display: grid;
  gap: 0.65rem;
  justify-items: end;
}

.next-best-action__side .primary-button {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
}

.next-best-action__side svg {
  width: 16px;
}

.next-best-action__blockers {
  display: flex;
  flex-wrap: wrap;
  gap: 0.45rem;
  justify-content: flex-end;
}

.next-best-action__blockers strong {
  width: 100%;
  text-align: right;
}

.next-best-action__blockers button {
  border: 1px solid var(--border-color);
  border-radius: 999px;
  background: var(--bg-elevated);
  color: var(--text-secondary);
  padding: 0.35rem 0.65rem;
  cursor: pointer;
}

@media (max-width: 760px) {
  .next-best-action {
    grid-template-columns: 1fr;
  }

  .next-best-action__side {
    justify-items: stretch;
  }

  .next-best-action__blockers,
  .next-best-action__blockers strong {
    justify-content: flex-start;
    text-align: left;
  }
}
</style>
