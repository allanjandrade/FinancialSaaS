<template>
  <PageShell
    eyebrow="Inteligência"
    title="Inteligência financeira"
    description="Use recursos inteligentes para analisar, planejar e revisar suas decisões."
    testid="ai-actions-hub"
  >
    <section class="hub-grid" aria-label="Recursos de inteligência">
      <router-link
        v-for="action in hubActions"
        :key="action.title"
        class="hub-card"
        :to="action.to"
        :data-testid="action.testid"
      >
        <span class="hub-icon"><component :is="action.icon" /></span>
        <strong>{{ action.title }}</strong>
        <p>{{ action.description }}</p>
      </router-link>
    </section>

    <section id="historico" class="history-panel" data-testid="ai-action-history">
      <div class="history-head">
        <div>
          <p class="eyebrow">Histórico</p>
          <h2>Ações confirmadas</h2>
          <p>Revise mudanças que você confirmou e reverta quando ainda for seguro.</p>
        </div>
        <button type="button" class="secondary-button" :disabled="loading" @click="loadHistory">
          <RefreshCcw />
          {{ loading ? 'Atualizando' : 'Atualizar' }}
        </button>
      </div>

      <EmptyState
        v-if="!loading && !history.length"
        :icon="ListChecks"
        title="Nenhuma ação confirmada"
        description="Quando você confirmar uma sugestão inteligente, ela aparecerá aqui com opção de revisão."
      />

      <div v-else class="history-list">
        <article v-for="item in history" :key="item.id" class="history-row">
          <div>
            <strong>{{ actionLabel(item.action_type) }}</strong>
            <p>{{ formatDateTime(item.created_at) }} · {{ item.reverted_at ? 'Revertida' : 'Confirmada' }}</p>
          </div>
          <button
            v-if="!item.reverted_at"
            type="button"
            class="secondary-button"
            :disabled="revertingId === item.id"
            @click="requestRevert(item)"
          >
            {{ revertingId === item.id ? 'Revertendo' : 'Reverter' }}
          </button>
        </article>
      </div>
      <p v-if="error" class="error-message" role="alert">{{ error }}</p>
    </section>

    <ConfirmModal
      :show="pendingRevert != null"
      title="Reverter ação confirmada?"
      :message="pendingRevertMessage"
      confirm-label="Reverter"
      destructive
      @confirm="confirmRevert"
      @cancel="pendingRevert = null"
    />
  </PageShell>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import {
  AlertTriangle,
  BarChart3,
  BellRing,
  Bot,
  FileSearch,
  HelpCircle,
  ListChecks,
  RefreshCcw,
  Search,
  ShoppingBag,
} from 'lucide-vue-next'
import PageShell from '@/components/layout/PageShell.vue'
import EmptyState from '@/components/EmptyState.vue'
import ConfirmModal from '@/components/ConfirmModal.vue'
import { listAiActionHistory, revertAiAction } from '@/api/ai-actions.js'
import { useNotification } from '@/composables/useNotification'

const { showToast } = useNotification()
const history = ref([])
const loading = ref(false)
const error = ref('')
const revertingId = ref('')
const pendingRevert = ref(null)

const hubActions = [
  {
    title: 'Consultar meu mês',
    description: 'Converse com o copiloto sobre saldo, gastos e prioridades.',
    to: '/ai',
    icon: Bot,
    testid: 'hub-consultar-mes',
  },
  {
    title: 'Simular uma compra',
    description: 'Veja impacto no mês antes de assumir um compromisso.',
    to: '/simulations/can-i-buy',
    icon: ShoppingBag,
    testid: 'hub-simular-compra',
  },
  {
    title: 'Encontrar risco no orçamento',
    description: 'Identifique categorias em atenção e próximos pontos de pressão.',
    to: '/advisor',
    icon: AlertTriangle,
    testid: 'hub-risco-orcamento',
  },
  {
    title: 'Revisar gastos por categoria',
    description: 'Compare evolução, concentração e comportamento por categoria.',
    to: '/reports',
    icon: BarChart3,
    testid: 'hub-revisar-categorias',
  },
  {
    title: 'Criar alerta inteligente',
    description: 'Configure avisos automáticos sem alterar seus dados financeiros.',
    to: '/automations',
    icon: BellRing,
    testid: 'hub-criar-alerta',
  },
  {
    title: 'Explicar meu relatório',
    description: 'Peça uma leitura em linguagem simples sobre os números.',
    to: '/advisor',
    icon: HelpCircle,
    testid: 'hub-explicar-relatorio',
  },
  {
    title: 'Buscar produto por descrição',
    description: 'Cadastre um item usando uma descrição curta e revise antes de salvar.',
    to: '/purchases/new?mode=text',
    icon: Search,
    testid: 'hub-buscar-produto',
  },
  {
    title: 'Ver ações confirmadas',
    description: 'Consulte o histórico do que foi confirmado ou revertido.',
    to: '/ai-actions#historico',
    icon: FileSearch,
    testid: 'hub-ver-acoes',
  },
]

const pendingRevertMessage = computed(() => {
  if (!pendingRevert.value) return ''
  return `Reverter "${actionLabel(pendingRevert.value.action_type)}"? A reversão só acontece se o item ainda estiver intacto.`
})

const actionLabels = {
  add_to_wishlist: 'Item adicionado à lista',
  create_alert: 'Alerta criado',
  create_recurring_rule: 'Regra recorrente criada',
  create_transaction: 'Lançamento criado',
  update_transaction_category: 'Categoria alterada',
  mark_as_internal_transfer: 'Transferência interna marcada',
}

function actionLabel(type) {
  return actionLabels[type] || 'Ação confirmada'
}

function formatDateTime(value) {
  if (!value) return 'Sem data'
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(value))
}

async function loadHistory() {
  loading.value = true
  error.value = ''
  try {
    history.value = await listAiActionHistory()
  } catch (err) {
    error.value = err?.message || 'Não foi possível carregar o histórico.'
  } finally {
    loading.value = false
  }
}

function requestRevert(item) {
  pendingRevert.value = item
}

async function confirmRevert() {
  const item = pendingRevert.value
  if (!item) return
  pendingRevert.value = null
  revertingId.value = item.id
  try {
    await revertAiAction(item.id)
    showToast('Ação revertida com segurança.', 'success')
    await loadHistory()
  } catch (err) {
    showToast(err?.message || 'Não foi possível reverter esta ação.', 'error')
  } finally {
    revertingId.value = ''
  }
}

onMounted(loadHistory)
</script>

<style scoped>
.hub-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(230px, 1fr));
  gap: 0.85rem;
}

.hub-card,
.history-panel {
  border: 1px solid var(--divider);
  border-radius: var(--radius-sm);
  background: var(--surface-ledger);
  box-shadow: none;
}

.hub-card {
  display: grid;
  gap: 0.55rem;
  min-height: 168px;
  padding: 1rem;
  color: var(--text-primary);
  text-decoration: none;
}

.hub-card:hover,
.hub-card:focus-visible {
  border-color: var(--border-strong);
  background: var(--surface-muted);
}

.hub-icon {
  width: 38px;
  height: 38px;
  display: grid;
  place-items: center;
  border-radius: 8px;
  background: var(--blue-dim);
  color: var(--accent-hover);
}

.hub-icon svg {
  width: 20px;
  height: 20px;
}

.hub-card p,
.history-head p,
.history-row p {
  margin: 0;
  color: var(--text-secondary);
  line-height: 1.5;
}

.history-panel {
  display: grid;
  gap: 1rem;
  padding: 1rem;
}

.history-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
}

.history-head h2 {
  margin: 0.15rem 0;
}

.eyebrow {
  margin: 0;
  color: var(--accent-hover);
  font-size: 0.75rem;
  font-weight: 800;
  text-transform: uppercase;
}

.history-list {
  display: grid;
  gap: 0.65rem;
}

.history-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 0.85rem;
  border: 1px solid var(--divider);
  border-radius: var(--radius-sm);
  background: var(--surface-muted);
}

.error-message {
  color: var(--danger);
  font-weight: 800;
}

@media (max-width: 640px) {
  .history-head,
  .history-row {
    display: grid;
  }
}
</style>
