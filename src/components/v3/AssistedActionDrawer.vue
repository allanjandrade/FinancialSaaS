<template>
  <Teleport to="body">
    <div v-if="show && execution" class="assisted-drawer" @click.self="requestClose">
      <section
        ref="drawerRef"
        class="assisted-drawer__sheet"
        data-testid="v34-assisted-drawer"
        role="dialog"
        aria-modal="true"
        :aria-labelledby="titleId"
        tabindex="-1"
        @keydown.esc="handleEsc"
      >
        <header class="assisted-drawer__header">
          <div class="assisted-drawer__title">
            <span>Execução assistida</span>
            <h2 :id="titleId">{{ execution.title || 'Ação assistida' }}</h2>
          </div>
          <button class="assisted-drawer__close" type="button" aria-label="Fechar" @click="requestClose">
            Fechar
          </button>
        </header>

        <div class="assisted-drawer__steps" aria-label="Etapas da execução">
          <span
            v-for="step in steps"
            :key="step.key"
            :class="{ active: activeStep === step.key, done: stepOrder[activeStep] > stepOrder[step.key] }"
          >
            {{ step.label }}
          </span>
        </div>

        <main class="assisted-drawer__body">
          <ul v-if="diagnosisLines.length" class="assisted-drawer__diagnosis">
            <li v-for="line in diagnosisLines" :key="line">{{ line }}</li>
          </ul>

          <component
            :is="activePanel"
            v-if="activeStep === 'execute' && activePanel"
            v-model="draft"
            :execution="execution"
            @route="routeExecution"
          />

          <section v-else-if="activeStep === 'confirmation'" class="assisted-drawer__confirmation">
            <span>Confirmação</span>
            <h3>{{ confirmation?.title }}</h3>
            <p>{{ confirmation?.message }}</p>
          </section>

          <section v-else-if="activeStep === 'success'" class="assisted-drawer__success" role="status">
            <span>Concluído</span>
            <h3>Ação registrada</h3>
            <p>Atualizamos a execução. A central financeira já pode refletir o próximo passo.</p>
          </section>

          <section v-else class="assisted-drawer__fallback">
            <p>Esta ação precisa continuar no fluxo principal.</p>
          </section>
        </main>

        <footer class="assisted-drawer__footer">
          <AppButton variant="ghost" @click="requestClose">
            {{ activeStep === 'success' ? 'Fechar' : 'Cancelar' }}
          </AppButton>

          <AppButton
            v-if="activeStep === 'execute' && canConfirm"
            :variant="primaryVariant"
            @click="prepareConfirmation"
          >
            Revisar confirmação
          </AppButton>
          <AppButton
            v-else-if="activeStep === 'execute'"
            variant="primary"
            @click="routeExecution"
          >
            Abrir fluxo
          </AppButton>
          <AppButton
            v-else-if="activeStep === 'confirmation'"
            :variant="confirmation?.destructive ? 'destructive' : 'primary'"
            @click="confirmExecution"
          >
            {{ confirmation?.confirmLabel || 'Confirmar' }}
          </AppButton>
        </footer>
      </section>
    </div>
  </Teleport>
</template>

<script setup>
import { computed, nextTick, ref, watch } from 'vue'
import AppButton from '@/components/ui/AppButton.vue'
import IncomeActionForm from '@/components/v3/actions/IncomeActionForm.vue'
import OcrReviewAction from '@/components/v3/actions/OcrReviewAction.vue'
import SubscriptionActionPanel from '@/components/v3/actions/SubscriptionActionPanel.vue'
import SubscriptionCutReview from '@/components/v3/actions/SubscriptionCutReview.vue'
import GoalActionForm from '@/components/v3/actions/GoalActionForm.vue'
import { buildExecutionConfirmation } from '@/domain/v3/actionExecution.js'

const props = defineProps({
  show: { type: Boolean, default: false },
  execution: { type: Object, default: null },
  successToken: { type: [String, Number, Boolean, Object], default: null },
})

const emit = defineEmits(['close', 'confirm', 'route'])

const drawerRef = ref(null)
const activeStep = ref('execute')
const confirmation = ref(null)
const draft = ref({})
const titleId = `assisted-drawer-title-${Math.random().toString(36).slice(2, 9)}`

const steps = [
  { key: 'execute', label: 'Preparar' },
  { key: 'confirmation', label: 'Confirmar' },
  { key: 'success', label: 'Sucesso' },
]

const stepOrder = {
  execute: 0,
  confirmation: 1,
  success: 2,
}

const panelByType = {
  'first-income': IncomeActionForm,
  'review-ocr': OcrReviewAction,
  'subscription-charge': SubscriptionActionPanel,
  'cut-dispensable-subscriptions': SubscriptionCutReview,
  'create-first-goal': GoalActionForm,
}

const activePanel = computed(() => panelByType[props.execution?.type] || null)
const canConfirm = computed(() => props.execution?.requiresConfirmation !== false && props.execution?.canWrite !== false)
const primaryVariant = computed(() => (confirmation.value?.destructive ? 'destructive' : 'primary'))
const diagnosisLines = computed(() => {
  const sources = [
    props.execution?.diagnosis,
    props.execution?.explanation,
    props.execution?.description,
  ]

  return sources
    .flatMap((source) => String(source || '').split(/\n+/))
    .map((line) => line.trim())
    .filter(Boolean)
})

watch(
  () => [props.show, props.execution],
  ([show]) => {
    if (!show || !props.execution) return
    resetExecutionState()
    nextTick(() => drawerRef.value?.focus())
  },
  { immediate: true },
)

watch(
  () => props.successToken,
  (nextToken, previousToken) => {
    if (!props.show || !props.execution) return
    if (nextToken === previousToken || nextToken === null || nextToken === undefined || nextToken === false) return
    activeStep.value = 'success'
  },
)

function resetExecutionState() {
  activeStep.value = 'execute'
  confirmation.value = null
  draft.value = { ...(props.execution?.draftDefaults || {}) }
}

function requestClose() {
  emit('close')
}

function handleEsc() {
  requestClose()
}

function routeExecution() {
  emit('route', props.execution?.fallbackRoute || props.execution?.route || '')
}

function prepareConfirmation() {
  confirmation.value = buildExecutionConfirmation(props.execution, draft.value)
  activeStep.value = 'confirmation'
}

function confirmExecution() {
  const currentConfirmation = confirmation.value || buildExecutionConfirmation(props.execution, draft.value)
  emit('confirm', {
    execution: props.execution,
    draft: { ...draft.value },
    confirmation: currentConfirmation,
  })
}
</script>

<style scoped>
.assisted-drawer {
  position: fixed;
  inset: 0;
  z-index: 1200;
  display: flex;
  justify-content: flex-end;
  background: color-mix(in srgb, var(--bg-main, #020617) 36%, transparent);
  backdrop-filter: blur(4px);
}

.assisted-drawer__sheet {
  width: min(100vw, 500px);
  height: 100vh;
  display: grid;
  grid-template-rows: auto auto minmax(0, 1fr) auto;
  border-left: 1px solid var(--divider-strong);
  background: var(--bg-panel);
  color: var(--text-primary);
  box-shadow: -22px 0 60px rgba(15, 23, 42, 0.28);
  outline: none;
}

.assisted-drawer__header,
.assisted-drawer__footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  padding: 1rem 1.1rem;
  border-bottom: 1px solid var(--divider);
}

.assisted-drawer__footer {
  border-top: 1px solid var(--divider);
  border-bottom: 0;
  justify-content: flex-end;
}

.assisted-drawer__title {
  display: grid;
  gap: 0.22rem;
}

.assisted-drawer__title span,
.assisted-drawer__confirmation span,
.assisted-drawer__success span {
  color: var(--accent);
  font-size: var(--text-xs);
  font-weight: 900;
  letter-spacing: var(--eyebrow-letter-spacing);
  text-transform: uppercase;
}

.assisted-drawer__title h2,
.assisted-drawer__confirmation h3,
.assisted-drawer__success h3 {
  margin: 0;
  font-size: 1.05rem;
  line-height: 1.25;
}

.assisted-drawer__close {
  border: 0;
  background: transparent;
  color: var(--text-secondary);
  font-size: 0.78rem;
  font-weight: 800;
  cursor: pointer;
}

.assisted-drawer__steps {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 0.45rem;
  padding: 0.75rem 1.1rem;
  border-bottom: 1px solid var(--divider);
}

.assisted-drawer__steps span {
  border: 1px solid var(--border-color);
  border-radius: 999px;
  padding: 0.32rem 0.5rem;
  color: var(--text-muted);
  background: color-mix(in srgb, var(--bg-panel) 86%, var(--bg-hover));
  font-size: 0.72rem;
  font-weight: 800;
  text-align: center;
}

.assisted-drawer__steps span.active {
  border-color: color-mix(in srgb, var(--accent) 42%, var(--border-color));
  color: var(--accent);
}

.assisted-drawer__steps span.done {
  border-color: color-mix(in srgb, var(--income) 34%, var(--border-color));
  color: var(--income);
}

.assisted-drawer__body {
  min-height: 0;
  display: grid;
  align-content: start;
  gap: 1rem;
  overflow: auto;
  padding: 1rem 1.1rem 1.25rem;
}

.assisted-drawer__diagnosis {
  display: grid;
  gap: 0.45rem;
  margin: 0;
  padding: 0.75rem 0.85rem;
  border: 1px solid color-mix(in srgb, var(--accent) 24%, var(--divider));
  border-radius: var(--radius-sm);
  background: color-mix(in srgb, var(--bg-panel) 88%, var(--blue-dim, transparent));
  color: var(--text-secondary);
  font-size: 0.82rem;
  line-height: 1.45;
  list-style-position: inside;
}

.assisted-drawer__confirmation,
.assisted-drawer__success,
.assisted-drawer__fallback {
  display: grid;
  gap: 0.55rem;
  padding-block: 0.35rem;
}

.assisted-drawer__confirmation p,
.assisted-drawer__success p,
.assisted-drawer__fallback p {
  margin: 0;
  color: var(--text-secondary);
  line-height: 1.55;
}

@media (max-width: 640px) {
  .assisted-drawer {
    justify-content: stretch;
  }

  .assisted-drawer__sheet {
    width: 100vw;
    border-left: 0;
  }

  .assisted-drawer__footer {
    align-items: stretch;
    flex-direction: column-reverse;
  }
}
</style>
