<template>
  <section class="contextual-assistant" :class="{ compact }" data-testid="contextual-assistant">
    <header class="assistant-head">
      <div>
        <p class="assistant-eyebrow">Copiloto contextual</p>
        <h2>Entenda seus dados desta tela</h2>
        <p>Análise somente leitura. Nenhuma alteração é executada pela IA.</p>
      </div>
      <Sparkles :size="22" aria-hidden="true" />
    </header>

    <div class="quick-questions" aria-label="Perguntas sugeridas">
      <button
        v-for="question in quickQuestions"
        :key="question"
        type="button"
        :disabled="state === 'loading'"
        @click="ask(question)"
      >
        {{ question }}
      </button>
    </div>

    <form class="assistant-form" @submit.prevent="ask(query)">
      <label :for="inputId">Pergunte sobre este contexto</label>
      <div class="assistant-input-row">
        <input
          :id="inputId"
          v-model="query"
          data-testid="ai-assist-input"
          maxlength="1200"
          minlength="3"
          placeholder="Ex.: o que merece minha atenção agora?"
          required
        />
        <button class="ask-button" data-testid="ai-assist-submit" type="submit" :disabled="state === 'loading' || query.trim().length < 3">
          <Loader2 v-if="state === 'loading'" class="spin" :size="18" />
          <Send v-else :size="18" />
          {{ state === 'loading' ? 'Analisando' : 'Analisar' }}
        </button>
      </div>
    </form>

    <div v-if="state === 'consent_required'" class="assistant-message warning" data-testid="ai-consent-required">
      <ShieldCheck :size="20" />
      <div>
        <strong>Consentimento necessário</strong>
        <p>Ative o copiloto nas configurações para permitir esta análise.</p>
        <router-link to="/settings?tab=ai">Revisar consentimento</router-link>
      </div>
    </div>

    <div v-else-if="state === 'quota_exceeded'" class="assistant-message warning" data-testid="ai-quota-exceeded">
      <Gauge :size="20" />
      <div><strong>Limite de uso atingido</strong><p>{{ errorMessage }}</p></div>
    </div>

    <div v-else-if="state === 'ai_not_configured' || state === 'error'" class="assistant-message error" data-testid="ai-assist-error">
      <AlertCircle :size="20" />
      <div><strong>Análise indisponível</strong><p>{{ errorMessage }}</p></div>
    </div>

    <article v-else-if="state === 'success' && result" class="assistant-result" data-testid="ai-assist-result">
      <div class="result-heading">
        <span class="confidence" :class="result.confidence">Confiança {{ confidenceLabel }}</span>
        <span class="read-only">Somente leitura</span>
      </div>
      <p class="answer">{{ result.answer }}</p>

      <div v-if="result.basis?.length" class="result-block">
        <strong>Base da análise</strong>
        <ul><li v-for="item in result.basis" :key="item">{{ item }}</li></ul>
      </div>
      <div v-if="result.warnings?.length" class="result-block warnings">
        <strong>Atenção</strong>
        <ul><li v-for="item in result.warnings" :key="item">{{ item }}</li></ul>
      </div>
      <div v-if="result.suggested_actions?.length" class="suggested-actions" data-testid="ai-readonly-actions">
        <template v-for="action in result.suggested_actions" :key="action.label">
          <button v-if="action.action_type" type="button" class="action-chip" :disabled="proposalLoading" @click="reviewAction(action)">{{ action.label }} <small>revisar antes de executar</small></button>
          <span v-else class="action-chip" aria-disabled="true">{{ action.label }} <small>não executável</small></span>
        </template>
      </div>
      <div v-if="result.suggested_questions?.length" class="quick-questions follow-up">
        <button v-for="question in result.suggested_questions" :key="question" type="button" @click="ask(question)">{{ question }}</button>
      </div>
    </article>
    <AIActionConfirmationModal v-if="pendingDraft" :draft="pendingDraft" :confirmation-token="confirmationToken" @close="closeReview" @confirmed="actionConfirmed" />
  </section>
</template>

<script setup>
import { computed, ref } from 'vue'
import { AlertCircle, Gauge, Loader2, Send, ShieldCheck, Sparkles } from 'lucide-vue-next'
import { AiAssistApiError, askContextualAssistant } from '@/api/ai-assist.js'
import { proposeAiAction } from '@/api/ai-actions.js'
import AIActionConfirmationModal from '@/components/AIActionConfirmationModal.vue'

const props = defineProps({
  contextType: { type: String, required: true },
  entityId: { type: String, default: null },
  compact: { type: Boolean, default: false },
})

const questionsByContext = {
  dashboard: ['O que merece minha atenção agora?', 'Como está minha projeção para o fim do mês?'],
  entries: ['Há algum gasto fora do padrão?', 'O que devo revisar nos lançamentos recentes?'],
  purchases: ['Esta compra cabe no meu momento financeiro?', 'Qual risco esta compra traz ao meu cartão?'],
  reports: ['Quais foram as principais mudanças do período?', 'Que anomalias aparecem neste relatório?'],
}

const state = ref('idle')
const query = ref('')
const result = ref(null)
const errorMessage = ref('')
const proposalLoading = ref(false)
const pendingDraft = ref(null)
const confirmationToken = ref('')
const quickQuestions = computed(() => questionsByContext[props.contextType] || questionsByContext.dashboard)
const inputId = computed(() => `ai-assist-${props.contextType}-${props.entityId || 'page'}`)
const confidenceLabel = computed(() => ({ high: 'alta', medium: 'média', low: 'baixa' }[result.value?.confidence] || 'baixa'))

async function ask(value) {
  const userQuery = String(value || '').trim()
  if (userQuery.length < 3 || state.value === 'loading') return
  query.value = userQuery
  state.value = 'loading'
  errorMessage.value = ''
  try {
    result.value = await askContextualAssistant({
      contextType: props.contextType,
      entityId: props.entityId,
      userQuery,
    })
    state.value = 'success'
  } catch (error) {
    result.value = null
    errorMessage.value = error?.message || 'Não foi possível concluir a análise.'
    if (error instanceof AiAssistApiError && error.code === 'CONSENT_REQUIRED') state.value = 'consent_required'
    else if (error instanceof AiAssistApiError && ['AI_DAILY_LIMIT_REACHED', 'AI_MONTHLY_LIMIT_REACHED'].includes(error.code)) state.value = 'quota_exceeded'
    else if (error instanceof AiAssistApiError && error.code === 'AI_NOT_CONFIGURED') state.value = 'ai_not_configured'
    else state.value = 'error'
  }
}

async function reviewAction(action) {
  if (!action?.action_type || !action?.payload || proposalLoading.value) return
  proposalLoading.value = true
  errorMessage.value = ''
  try {
    const response = await proposeAiAction({ actionType: action.action_type, payload: action.payload })
    pendingDraft.value = response.draft
    confirmationToken.value = response.confirmation_token
  } catch (error) {
    errorMessage.value = error?.message || 'Não foi possível preparar a revisão.'
  } finally { proposalLoading.value = false }
}

function closeReview() { pendingDraft.value = null; confirmationToken.value = '' }
function actionConfirmed() { closeReview(); errorMessage.value = ''; query.value = ''; state.value = 'idle' }
</script>

<style scoped>
.contextual-assistant { display: grid; gap: 1rem; padding: 1.15rem; border: 1px solid color-mix(in srgb, var(--accent) 28%, var(--divider)); border-radius: var(--radius-sm); background: var(--surface-ledger); box-shadow: none; }
.contextual-assistant.compact { gap: 0.7rem; padding: 0.9rem; border-radius: 8px; }
.assistant-head { display: flex; justify-content: space-between; gap: 1rem; color: var(--accent); }
.assistant-head h2 { margin: 0.15rem 0; color: var(--text-primary); font-size: 1.05rem; }
.assistant-head p { margin: 0; color: var(--text-secondary); font-size: 0.82rem; }
.assistant-eyebrow { color: var(--accent) !important; font-family: var(--font-sans); font-size: var(--text-xs) !important; font-weight: 700; text-transform: uppercase; letter-spacing: var(--eyebrow-letter-spacing); }
.quick-questions { display: flex; gap: 0.5rem; flex-wrap: wrap; }
.quick-questions button { border: 1px solid var(--border-color); border-radius: var(--radius-sm); padding: 0.48rem 0.72rem; background: var(--bg-hover); color: var(--text-secondary); cursor: pointer; font-size: 0.78rem; }
.quick-questions button:hover { border-color: var(--accent); color: var(--text-primary); }
.assistant-form { display: grid; gap: 0.45rem; }
.assistant-form label { color: var(--text-secondary); font-size: 0.75rem; font-weight: 700; }
.assistant-input-row { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 0.55rem; }
.assistant-input-row input { min-width: 0; border: 1px solid var(--border-color); border-radius: 9px; padding: 0.72rem 0.8rem; background: var(--bg-input); color: var(--text-primary); }
.ask-button { display: flex; align-items: center; gap: 0.45rem; border: 0; border-radius: 9px; padding: 0.7rem 0.9rem; background: var(--accent); color: white; font-weight: 700; cursor: pointer; }
.ask-button:disabled { opacity: 0.6; cursor: not-allowed; }
.assistant-message { display: flex; gap: 0.7rem; padding: 0.85rem; border-radius: 9px; font-size: 0.84rem; }
.assistant-message p { margin: 0.2rem 0; }.assistant-message a { color: inherit; font-weight: 800; }
.assistant-message.warning { background: rgba(251, 191, 36, 0.1); color: #d99b13; }.assistant-message.error { background: rgba(248, 113, 113, 0.1); color: #ef6b6b; }
.assistant-result { display: grid; gap: 0.8rem; border-top: 1px solid var(--border-color); padding-top: 0.9rem; }
.result-heading { display: flex; justify-content: space-between; gap: 0.5rem; }.confidence,.read-only { border-radius: var(--radius-sm); padding: 0.25rem 0.55rem; font-size: 0.68rem; font-weight: 800; text-transform: uppercase; }.confidence.high { color: var(--income); background: var(--income-dim); }.confidence.medium { color: var(--warning); background: var(--savings-dim); }.confidence.low { color: var(--expense); background: var(--expense-dim); }.read-only { color: var(--text-muted); background: var(--bg-hover); }
.answer { margin: 0; color: var(--text-primary); line-height: 1.6; }.result-block strong { color: var(--text-primary); font-size: 0.8rem; }.result-block ul { margin: 0.4rem 0 0; padding-left: 1.1rem; color: var(--text-secondary); font-size: 0.8rem; }.warnings { color: #fbbf24; }
.suggested-actions { display: flex; gap: 0.45rem; flex-wrap: wrap; }.action-chip { border: 1px dashed var(--border-color); border-radius: 8px; padding: 0.45rem 0.6rem; background:var(--bg-hover);color: var(--text-secondary); font-size: 0.75rem;text-align:left;cursor:pointer }.action-chip:not(:disabled):hover{border-color:var(--accent);color:var(--text-primary)}.action-chip:disabled{cursor:not-allowed;opacity:.7}.action-chip small { display: block; color: var(--text-muted); }.follow-up { border-top: 1px solid var(--border-color); padding-top: 0.75rem; }
.spin { animation: spin 1s linear infinite; }@keyframes spin { to { transform: rotate(360deg); } }
.compact .assistant-head h2 { font-size: 0.95rem; }
.compact .assistant-head p { display: none; }
.compact .quick-questions { gap: 0.35rem; }
.compact .quick-questions button { padding: 0.38rem 0.55rem; font-size: 0.7rem; }
.compact .assistant-form { gap: 0.35rem; }
.compact .assistant-form label { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
.compact .assistant-input-row { grid-template-columns: 1fr; }
.compact .ask-button { justify-content: center; padding: 0.6rem 0.75rem; }
@media (max-width: 640px) { .assistant-input-row { grid-template-columns: 1fr; }.ask-button { justify-content: center; } }
</style>
