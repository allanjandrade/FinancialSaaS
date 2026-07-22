<template>
  <section class="os-map" data-testid="v3-operating-system-map" aria-label="Sistema operacional financeiro">
    <header>
      <div>
        <span>Sistema operacional financeiro</span>
        <h2>{{ system.headline }}</h2>
        <p>{{ system.summary }}</p>
      </div>
      <router-link class="analysis-link" :to="system.analysisRoute || '/analysis'">Abrir análises</router-link>
    </header>

    <div class="stage-grid">
      <router-link
        v-for="(stage, index) in system.stages"
        :key="stage.key"
        class="stage-card"
        :class="[stage.state, { active: stage.key === system.activeStage?.key }]"
        :to="stage.route"
      >
        <b>{{ index + 1 }}</b>
        <span>
          <strong>{{ stage.label }}</strong>
          <small>{{ stage.detail }}</small>
        </span>
        <em>{{ stateLabel(stage.state) }}</em>
      </router-link>
    </div>
  </section>
</template>

<script setup>
defineProps({
  system: {
    type: Object,
    required: true,
  },
})

function stateLabel(state) {
  return {
    critical: 'Crítico',
    attention: 'Atenção',
    healthy: 'Conectado',
    ready: 'Pronto',
  }[state] || 'Pronto'
}
</script>

<style scoped>
.os-map {
  display: grid;
  gap: 1rem;
  border: 1px solid var(--divider);
  border-radius: var(--radius-sm);
  background: var(--surface-ledger);
  box-shadow: none;
  padding: clamp(1rem, 2vw, 1.25rem);
}

.os-map header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
}

.os-map header div {
  display: grid;
  gap: 0.28rem;
}

.os-map span:first-child,
.stage-card em {
  color: var(--accent);
  font-size: var(--text-xs);
  font-weight: 900;
  letter-spacing: var(--eyebrow-letter-spacing);
  text-transform: uppercase;
}

.os-map h2 {
  margin: 0;
  color: var(--text-primary);
  font-size: 1.15rem;
}

.os-map p {
  margin: 0;
  color: var(--text-secondary);
}

.analysis-link {
  min-height: 40px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  padding: 0 0.85rem;
  background: var(--bg-elevated);
  color: var(--text-primary);
  font-weight: 850;
  text-decoration: none;
  white-space: nowrap;
}

.stage-grid {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 0.75rem;
}

.stage-card {
  min-width: 0;
  display: grid;
  grid-template-rows: auto 1fr auto;
  gap: 0.7rem;
  min-height: 172px;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  padding: 0.9rem;
  background: var(--bg-elevated);
  color: inherit;
  text-decoration: none;
}

.stage-card.active {
  border-color: color-mix(in srgb, var(--accent) 42%, var(--border-color));
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--accent) 16%, transparent);
}

.stage-card b {
  width: 32px;
  height: 32px;
  display: grid;
  place-items: center;
  border-radius: 999px;
  background: var(--blue-dim);
  color: var(--accent);
}

.stage-card span {
  display: grid;
  gap: 0.35rem;
}

.stage-card strong {
  color: var(--text-primary);
  line-height: 1.2;
}

.stage-card small {
  color: var(--text-secondary);
  line-height: 1.42;
}

.stage-card em {
  justify-self: start;
  border-radius: 999px;
  padding: 0.24rem 0.52rem;
  background: var(--blue-dim);
  font-style: normal;
}

.stage-card.critical em {
  color: var(--expense);
  background: var(--expense-dim);
}

.stage-card.attention em {
  color: var(--warning);
  background: rgba(251, 191, 36, 0.16);
}

.stage-card.healthy em {
  color: var(--income);
  background: var(--income-dim);
}

@media (max-width: 1180px) {
  .stage-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 620px) {
  .os-map header,
  .stage-grid {
    grid-template-columns: 1fr;
  }

  .os-map header {
    display: grid;
  }

  .stage-card {
    min-height: 0;
  }
}
</style>
