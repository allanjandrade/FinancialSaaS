<template>
  <LedgerPage
    class="subscriptions-view ledger-page-shell"
    eyebrow="Planejamento"
    title="Assinaturas"
    description="Controle cobranças recorrentes antes que elas virem surpresa no cartão ou na conta."
    testid="subscriptions-page"
  >
    <template #actions>
      <button class="primary-button" data-testid="top-subscription-create" type="button" @click="startCreate">
        <Plus :size="16" />
        Nova assinatura
      </button>
    </template>

    <section v-if="hasSubscriptions" class="subscriptions-layout" data-testid="subscriptions-layout">
      <div class="content-column">
        <section class="kpi-grid" aria-label="Resumo de assinaturas">
          <article class="kpi-card">
            <span>Total mensal</span>
            <strong>{{ formatMoney(summary.totalMonthly) }}</strong>
            <small>{{ summary.activeCount }} ativas na previsão</small>
          </article>
          <article class="kpi-card">
            <span>Total anualizado</span>
            <strong>{{ formatMoney(summary.totalAnnualized) }}</strong>
            <small>Custo equivalente em 12 meses</small>
          </article>
          <article class="kpi-card" data-testid="next-charge-card">
            <span>Próxima cobrança</span>
            <strong>{{ nextChargeTitle }}</strong>
            <small>{{ nextChargeDetail }}</small>
          </article>
          <article class="kpi-card">
            <span>Economia possível</span>
            <strong>{{ formatMoney(summary.dispensableMonthly) }}</strong>
            <small>Marcadas como dispensáveis</small>
          </article>
        </section>

        <section class="panel list-panel">
          <div class="panel-head filters-head">
            <div>
              <h2>Lista por categoria</h2>
              <p>{{ filteredSubscriptions.length }} assinaturas encontradas.</p>
            </div>
            <div class="filters">
              <select v-model="filters.category" aria-label="Filtrar por categoria">
                <option value="">Todas categorias</option>
                <option v-for="category in categories" :key="category" :value="category">{{ category }}</option>
              </select>
              <select v-model="filters.status" aria-label="Filtrar por status">
                <option value="">Todos status</option>
                <option v-for="status in statusOptions" :key="status.value" :value="status.value">{{ status.label }}</option>
              </select>
              <select v-model="filters.payment" aria-label="Filtrar por pagamento">
                <option value="">Todos pagamentos</option>
                <option value="card">Cartão</option>
                <option value="account">Conta bancária</option>
                <option value="benefit">Benefício</option>
                <option value="other">Outro</option>
              </select>
              <select v-model="sortBy" aria-label="Ordenação">
                <option value="next">Próxima cobrança</option>
                <option value="amount">Maior valor</option>
                <option value="category">Categoria</option>
              </select>
            </div>
          </div>

          <EmptyState
            v-if="!visibleGroups.length"
            :icon="Receipt"
            title="Nenhuma assinatura encontrada"
            description="Ajuste os filtros ou cadastre uma nova assinatura recorrente."
            action-label="Nova assinatura"
            @action="startCreate"
          />

          <div v-else class="category-groups ledger-row-list subscriptions-ledger-list">
            <section v-for="group in visibleGroups" :key="group.category" class="category-group">
              <header>
                <h3>{{ group.category }}</h3>
                <span>{{ formatMoney(group.total) }}/mês equivalente</span>
              </header>

              <!-- Fluid ledger exception: repeated service identity item with logo and contextual actions. -->
              <article
                v-for="item in group.items"
                :key="item.id"
                class="subscription-row ledger-row"
                :data-testid="subscriptionCardTestId(item)"
                @keydown.esc="closeActionMenu"
              >
                <div class="subscription-card-top">
                  <div class="subscription-identity">
                    <span
                      class="service-logo-tile"
                      data-testid="subscription-service-logo"
                      :aria-label="`Logo ${servicePresentation(item).provider}`"
                      :style="serviceLogoStyle(item)"
                    >
                      {{ servicePresentation(item).logo }}
                    </span>
                    <div class="subscription-main">
                      <div class="row-title">
                        <strong>{{ item.name }}</strong>
                        <span class="status-badge" :class="statusBadgeClass(item.status)">{{ statusLabel(item.status) }}</span>
                        <span v-if="item.is_essential" class="essential-badge">Essencial</span>
                      </div>
                      <p>{{ item.provider || 'Fornecedor não informado' }} · {{ cycleLabel(item.billing_cycle) }} · {{ sourceLabel(item) }}</p>
                      <small>Próxima cobrança: {{ formatDate(item.next_billing_date) }} · Alerta {{ item.reminder_days }} dias antes</small>
                    </div>
                  </div>

                  <div class="subscription-card-meta">
                    <strong class="subscription-amount">{{ formatMoney(item.amount) }}</strong>
                    <div class="action-menu">
                      <button
                        class="icon-menu-button"
                        data-testid="subscription-action-menu"
                        type="button"
                        :aria-label="`Ações de ${item.name}`"
                        aria-haspopup="menu"
                        :aria-expanded="openActionMenuId === item.id"
                        @click.stop="toggleActionMenu(item.id)"
                      >
                        <MoreHorizontal :size="18" />
                      </button>

                      <div
                        v-if="openActionMenuId === item.id"
                        class="context-menu"
                        data-testid="subscription-action-menu-content"
                        role="menu"
                      >
                        <button type="button" role="menuitem" @click="editFromMenu(item)">Editar</button>
                        <a
                          v-if="cancellationLinkFor(item)"
                          data-testid="subscription-cancel-link"
                          :href="cancellationLinkFor(item)"
                          target="_blank"
                          rel="noopener noreferrer"
                          role="menuitem"
                          @click="closeActionMenu"
                        >
                          Abrir cancelamento
                        </a>
                        <button type="button" role="menuitem" :disabled="item.status === 'paused'" @click="pauseFromMenu(item)">Pausar</button>
                        <button type="button" role="menuitem" :disabled="item.status === 'cancelled'" @click="cancelFromMenu(item)">Cancelar</button>
                        <button class="danger" type="button" role="menuitem" @click="deleteFromMenu(item)">Excluir</button>
                      </div>
                    </div>
                  </div>
                </div>

                <details class="charge-history">
                  <summary>Histórico de cobranças</summary>
                  <div v-if="chargesFor(item.id).length" class="history-list">
                    <div v-for="charge in chargesFor(item.id)" :key="charge.id">
                      <span>{{ formatDate(charge.charged_at) }}</span>
                      <strong>{{ formatMoney(charge.amount) }}</strong>
                      <small>{{ charge.status === 'paid' ? 'Paga/vinculada' : charge.status }}</small>
                    </div>
                  </div>
                  <p v-else>Nenhuma cobrança real vinculada ainda.</p>
                </details>
              </article>
            </section>
          </div>
        </section>
      </div>

      <aside class="side-column" aria-label="Impacto e alertas">
        <section class="panel insight-panel impact-panel">
          <div class="panel-head compact">
            <div>
              <h2>Impacto do mês</h2>
              <p>Previsão sem duplicar cobranças já pagas.</p>
            </div>
          </div>
          <dl>
            <div>
              <dt>Previsto ainda não pago</dt>
              <dd>{{ formatMoney(summary.monthImpact.forecastTotal) }}</dd>
            </div>
            <div>
              <dt>Já vinculado a lançamentos</dt>
              <dd>{{ formatMoney(summary.monthImpact.actualLinkedTotal) }}</dd>
            </div>
          </dl>
          <div class="impact-bars" aria-label="Distribuição por forma de pagamento">
            <div class="impact-bar-row">
              <div>
                <span>Cartão</span>
                <strong>{{ formatMoney(summary.monthImpact.cardImpact) }}</strong>
              </div>
              <div class="impact-bar-track">
                <span class="impact-bar-fill card" data-testid="impact-card-bar" :style="{ '--bar-value': `${impactCardPercent}%` }" />
              </div>
            </div>
            <div class="impact-bar-row">
              <div>
                <span>Conta</span>
                <strong>{{ formatMoney(summary.monthImpact.accountImpact) }}</strong>
              </div>
              <div class="impact-bar-track">
                <span class="impact-bar-fill account" data-testid="impact-account-bar" :style="{ '--bar-value': `${impactAccountPercent}%` }" />
              </div>
            </div>
          </div>
        </section>

        <section class="panel alerts-panel">
          <div class="panel-head">
            <div>
              <h2>Alertas</h2>
              <p>Cobranças próximas, testes, duplicidades e itens cortáveis.</p>
            </div>
          </div>
          <div v-if="summary.alerts.length" class="alert-list">
            <div v-for="alert in summary.alerts" :key="`${alert.type}-${alert.subscriptionId}`" class="alert-row" :class="alert.severity">
              <strong>{{ alert.title }}</strong>
              <span>{{ alert.description }}</span>
            </div>
          </div>
          <p v-else class="empty-inline">Nenhum alerta crítico para os próximos dias.</p>
        </section>
      </aside>
    </section>

    <section v-else class="panel empty-subscriptions" data-testid="subscriptions-empty-state">
      <div class="empty-illustration" aria-hidden="true">
        <span class="empty-bill one" />
        <span class="empty-bill two" />
        <span class="empty-dot" />
      </div>
      <div>
        <h2>Você ainda não tem assinaturas cadastradas.</h2>
        <p>Que tal começar com a Netflix ou o Spotify?</p>
      </div>
      <button class="primary-button" data-testid="empty-subscription-create" type="button" @click="startCreate">
        Cadastrar Minha Primeira Assinatura
      </button>
    </section>

    <div v-if="formOpen" class="drawer-layer" data-testid="subscription-form-drawer" @click.self="closeForm">
      <aside class="subscription-drawer" role="dialog" aria-modal="true" :aria-label="editingId ? 'Editar assinatura' : 'Cadastro de assinatura'">
        <header class="drawer-head">
          <div>
            <h2>{{ editingId ? 'Editar assinatura' : 'Cadastro de assinatura' }}</h2>
            <p>Assinatura é previsão recorrente, não despesa solta.</p>
          </div>
          <button class="drawer-close" type="button" aria-label="Fechar cadastro de assinatura" @click="closeForm">×</button>
        </header>

        <form class="subscription-form" @submit.prevent="submitForm">
          <label>
            Nome da assinatura
            <input
              v-model.trim="form.name"
              data-testid="subscription-name-input"
              required
              maxlength="80"
              placeholder="Netflix, ChatGPT, Seguro..."
            />
          </label>

          <div v-if="serviceSuggestion" class="service-suggestion" data-testid="subscription-service-suggestion">
            <span class="service-logo">{{ serviceSuggestion.logo }}</span>
            <div>
              <strong>{{ serviceSuggestion.provider }}</strong>
              <small>Categoria sugerida: {{ serviceSuggestion.category }}</small>
            </div>
          </div>

          <label>
            Fornecedor
            <input v-model.trim="form.provider" data-testid="subscription-provider-input" maxlength="80" placeholder="OpenAI, Amazon, Sem Parar..." />
          </label>
          <div class="form-row">
            <label>
              Categoria
              <select v-model="form.category" data-testid="subscription-category-select" required>
                <option v-for="category in categories" :key="category" :value="category">{{ category }}</option>
              </select>
            </label>
            <label>
              Valor atual
              <input v-model.number="form.amount" required type="number" min="0" step="0.01" />
            </label>
          </div>
          <div class="form-row">
            <label>
              Ciclo
              <select v-model="form.billing_cycle" required>
                <option v-for="cycle in cycleOptions" :key="cycle.value" :value="cycle.value">{{ cycle.label }}</option>
              </select>
            </label>
            <label>
              Intervalo
              <input v-model.number="form.billing_interval" type="number" min="1" step="1" />
            </label>
          </div>
          <div class="form-row">
            <label>
              Próxima cobrança
              <input v-model="form.next_billing_date" required type="date" />
            </label>
            <label>
              Início
              <input v-model="form.started_at" type="date" />
            </label>
          </div>
          <div class="form-row">
            <label>
              Status
              <select v-model="form.status" required>
                <option v-for="status in statusOptions" :key="status.value" :value="status.value">{{ status.label }}</option>
              </select>
            </label>
            <label>
              Forma de pagamento
              <select v-model="form.sourceKey">
                <option v-for="source in sourceOptions" :key="source.key" :value="source.key">{{ source.label }}</option>
              </select>
            </label>
          </div>
          <div class="form-row">
            <label>
              Alerta antes da cobrança
              <input v-model.number="form.reminder_days" type="number" min="0" step="1" />
            </label>
            <label>
              Site ou cancelamento
              <input v-model.trim="form.url" type="url" placeholder="https://..." />
            </label>
          </div>
          <label class="switch-row">
            <input v-model="form.is_essential" type="checkbox" />
            <span>Marcar como essencial</span>
          </label>
          <label>
            Observações
            <textarea v-model.trim="form.notes" rows="3" maxlength="240" placeholder="Plano, usuário, uso informado ou regra de corte." />
          </label>

          <div class="form-actions">
            <button class="secondary-button" type="button" @click="resetForm">Limpar</button>
            <button class="secondary-button" type="button" @click="closeForm">Cancelar</button>
            <button class="primary-button" type="submit">
              {{ editingId ? 'Salvar alterações' : 'Cadastrar assinatura' }}
            </button>
          </div>
        </form>
      </aside>
    </div>

    <ConfirmModal
      :show="deleteTarget != null"
      title="Excluir assinatura"
      :message="`Deseja excluir ${deleteTarget?.name || 'esta assinatura'}? O registro será removido da visão ativa, mas mantido como exclusão lógica.`"
      confirm-label="Excluir"
      destructive
      @confirm="confirmDelete"
      @cancel="deleteTarget = null"
    />
  </LedgerPage>
</template>

<script setup>
import { computed, reactive, ref, watch } from 'vue'
import { MoreHorizontal, Plus, Receipt } from 'lucide-vue-next'
import ConfirmModal from '@/components/ConfirmModal.vue'
import EmptyState from '@/components/EmptyState.vue'
import LedgerPage from '@/components/layout/LedgerPage.vue'
import { useNotification } from '@/composables/useNotification'
import { useFinanceStore } from '@/stores/finance.js'
import {
  SUBSCRIPTION_CATEGORIES,
  buildSubscriptionSummary,
  isForecastableSubscription,
  projectSubscriptionCharges,
  subscriptionMonthlyEquivalent,
} from '@/utils/subscriptions.js'
import { normalizeExternalUrl } from '@/utils/safe-url.js'

const DAY_MS = 24 * 60 * 60 * 1000
const NEXT_CHARGE_LOOKAHEAD_DAYS = 370

const financeStore = useFinanceStore()
const { showToast } = useNotification()

const categories = SUBSCRIPTION_CATEGORIES
const cycleOptions = [
  { value: 'monthly', label: 'Mensal' },
  { value: 'annual', label: 'Anual' },
  { value: 'weekly', label: 'Semanal' },
  { value: 'biweekly', label: 'Quinzenal' },
  { value: 'quarterly', label: 'Trimestral' },
  { value: 'semiannual', label: 'Semestral' },
  { value: 'custom', label: 'Personalizado' },
]
const statusOptions = [
  { value: 'active', label: 'Ativa' },
  { value: 'trial', label: 'Teste grátis' },
  { value: 'paused', label: 'Pausada' },
  { value: 'cancelled', label: 'Cancelada' },
  { value: 'expired', label: 'Expirada' },
]

const filters = reactive({ category: '', status: '', payment: '' })
const sortBy = ref('next')
const editingId = ref('')
const deleteTarget = ref(null)
const formOpen = ref(false)
const lastAppliedSuggestion = ref(null)
const openActionMenuId = ref('')

const form = reactive(defaultForm())
const referenceDate = computed(() => new Date().toISOString().split('T')[0])
const summary = computed(() => buildSubscriptionSummary(financeStore.state, referenceDate.value))

const sourceOptions = computed(() => {
  const options = [{ key: 'other:', label: 'Outro', type: 'other', id: '' }]
  ;(financeStore.state.creditCards || []).forEach((card) => {
    options.push({ key: `card:${card.id}`, label: `${card.name} · cartão`, type: 'card', id: card.id })
  })
  ;(financeStore.state.financialAccounts || []).forEach((account) => {
    options.push({ key: `account:${account.id}`, label: `${account.name} · conta`, type: 'account', id: account.id })
  })
  ;(financeStore.state.benefitWallets || []).forEach((benefit) => {
    options.push({ key: `benefit:${benefit.id}`, label: `${benefit.name} · benefício`, type: 'benefit', id: benefit.id })
  })
  return options
})

const activeSubscriptions = computed(() => (financeStore.state.subscriptions || [])
  .filter((item) => !item.deleted_at))
const hasSubscriptions = computed(() => activeSubscriptions.value.length > 0)

const filteredSubscriptions = computed(() => {
  const rows = activeSubscriptions.value
    .filter((item) => !filters.category || item.category === filters.category)
    .filter((item) => !filters.status || item.status === filters.status)
    .filter((item) => !filters.payment || item.payment_method_type === filters.payment)

  return [...rows].sort((a, b) => {
    if (sortBy.value === 'amount') return Number(b.amount || 0) - Number(a.amount || 0)
    if (sortBy.value === 'category') return String(a.category).localeCompare(String(b.category), 'pt-BR')
    return new Date(a.next_billing_date) - new Date(b.next_billing_date)
  })
})

const visibleGroups = computed(() => {
  const grouped = new Map()
  filteredSubscriptions.value.forEach((item) => {
    if (!grouped.has(item.category)) grouped.set(item.category, [])
    grouped.get(item.category).push(item)
  })
  return [...grouped.entries()].map(([category, items]) => ({
    category,
    items,
    total: items.reduce((sum, item) => sum + subscriptionMonthlyEquivalent(item), 0),
  }))
})

const nextCharge = computed(() => {
  const from = referenceDate.value
  const to = addDaysIso(from, NEXT_CHARGE_LOOKAHEAD_DAYS)
  return activeSubscriptions.value
    .filter(isForecastableSubscription)
    .flatMap((subscription) => projectSubscriptionCharges(subscription, { from, to })
      .map((charge) => ({
        ...charge,
        daysUntil: dateDiffDays(from, charge.date),
      })))
    .sort((a, b) => a.daysUntil - b.daysUntil || Number(b.amount || 0) - Number(a.amount || 0))[0] || null
})

const nextChargeTitle = computed(() => {
  if (!nextCharge.value) return 'Sem cobrança'
  return `${formatMoney(nextCharge.value.amount)} em ${formatShortDate(nextCharge.value.date)}`
})
const nextChargeDetail = computed(() => {
  if (!nextCharge.value) return 'Cadastre assinaturas para prever vencimentos'
  return `${nextCharge.value.name} · ${relativeBillingText(nextCharge.value.daysUntil)}`
})
const impactDistributionTotal = computed(() => (
  Number(summary.value.monthImpact.cardImpact || 0)
  + Number(summary.value.monthImpact.accountImpact || 0)
))
const impactCardPercent = computed(() => impactPercent(summary.value.monthImpact.cardImpact))
const impactAccountPercent = computed(() => impactPercent(summary.value.monthImpact.accountImpact))
const serviceSuggestion = computed(() => suggestKnownService(form.name))

watch(serviceSuggestion, (suggestion) => {
  if (!suggestion || editingId.value) return

  const previous = lastAppliedSuggestion.value
  if (!form.provider || form.provider === previous?.provider) {
    form.provider = suggestion.provider
  }
  if (!form.category || ['Streaming', 'Outros', previous?.category].includes(form.category)) {
    form.category = suggestion.category
  }
  if (!form.url && suggestion.url) form.url = suggestion.url
  lastAppliedSuggestion.value = suggestion
})

const SERVICE_SUGGESTIONS = [
  { terms: ['netflix'], provider: 'Netflix', category: 'Streaming', logo: 'N', url: 'https://www.netflix.com', cancelUrl: 'https://www.netflix.com/cancelplan', color: '#e50914', background: '#fee2e2' },
  { terms: ['spotify'], provider: 'Spotify', category: 'Streaming', logo: 'S', url: 'https://www.spotify.com', cancelUrl: 'https://www.spotify.com/account/subscription/', color: '#1db954', background: '#dcfce7' },
  { terms: ['amazon prime', 'prime video', 'amazon'], provider: 'Amazon Prime', category: 'Streaming', logo: 'P', url: 'https://www.primevideo.com', cancelUrl: 'https://www.amazon.com/gp/primecentral', color: '#0f172a', background: '#dbeafe' },
  { terms: ['disney'], provider: 'Disney+', category: 'Streaming', logo: 'D', url: 'https://www.disneyplus.com', cancelUrl: 'https://www.disneyplus.com/account', color: '#113ccf', background: '#dbeafe' },
  { terms: ['hbo', 'max'], provider: 'Max', category: 'Streaming', logo: 'M', url: 'https://www.max.com', cancelUrl: 'https://auth.max.com/settings', color: '#1d4ed8', background: '#dbeafe' },
  { terms: ['youtube'], provider: 'YouTube', category: 'Streaming', logo: 'Y', url: 'https://www.youtube.com/premium', cancelUrl: 'https://www.youtube.com/paid_memberships', color: '#dc2626', background: '#fee2e2' },
  { terms: ['chatgpt', 'openai'], provider: 'OpenAI', category: 'IA', logo: 'AI', url: 'https://chatgpt.com', cancelUrl: 'https://chatgpt.com/#settings/Subscription', color: '#0f766e', background: '#ccfbf1' },
  { terms: ['claude'], provider: 'Anthropic', category: 'IA', logo: 'C', url: 'https://claude.ai', cancelUrl: 'https://claude.ai/settings/billing', color: '#9a3412', background: '#ffedd5' },
  { terms: ['gemini'], provider: 'Google Gemini', category: 'IA', logo: 'G', url: 'https://gemini.google.com', cancelUrl: 'https://one.google.com/settings', color: '#2563eb', background: '#dbeafe' },
  { terms: ['google one'], provider: 'Google One', category: 'Casa', logo: 'G', url: 'https://one.google.com', cancelUrl: 'https://one.google.com/settings', color: '#2563eb', background: '#dbeafe' },
  { terms: ['icloud', 'apple'], provider: 'Apple iCloud', category: 'Casa', logo: 'i', url: 'https://www.icloud.com', cancelUrl: 'https://account.apple.com/account/manage', color: '#334155', background: '#e2e8f0' },
  { terms: ['sem parar'], provider: 'Sem Parar', category: 'Mobilidade', logo: 'SP', url: 'https://www.semparar.com.br', cancelUrl: 'https://minhaconta.semparar.com.br/', color: '#b45309', background: '#fef3c7' },
  { terms: ['adobe'], provider: 'Adobe', category: 'Software', logo: 'A', url: 'https://www.adobe.com', cancelUrl: 'https://account.adobe.com/plans', color: '#dc2626', background: '#fee2e2' },
  { terms: ['microsoft', 'office 365', 'microsoft 365'], provider: 'Microsoft', category: 'Software', logo: 'M', url: 'https://www.microsoft.com/microsoft-365', cancelUrl: 'https://account.microsoft.com/services', color: '#2563eb', background: '#dbeafe' },
]

function defaultForm() {
  return {
    name: '',
    provider: '',
    category: 'Streaming',
    amount: 0,
    billing_cycle: 'monthly',
    billing_interval: 1,
    next_billing_date: new Date().toISOString().split('T')[0],
    started_at: '',
    status: 'active',
    sourceKey: 'other:',
    reminder_days: 3,
    is_essential: false,
    notes: '',
    url: '',
  }
}

function startCreate() {
  editingId.value = ''
  resetForm()
  formOpen.value = true
}

function startEdit(item) {
  editingId.value = item.id
  lastAppliedSuggestion.value = null
  Object.assign(form, {
    name: item.name || '',
    provider: item.provider || '',
    category: item.category || 'Outros',
    amount: Number(item.amount || 0),
    billing_cycle: item.billing_cycle || 'monthly',
    billing_interval: Number(item.billing_interval || 1),
    next_billing_date: item.next_billing_date || new Date().toISOString().split('T')[0],
    started_at: item.started_at || '',
    status: item.status || 'active',
    sourceKey: sourceKeyFor(item),
    reminder_days: Number(item.reminder_days || 3),
    is_essential: Boolean(item.is_essential),
    notes: item.notes || '',
    url: item.url || '',
  })
  formOpen.value = true
}

function resetForm() {
  lastAppliedSuggestion.value = null
  Object.assign(form, defaultForm())
}

function closeForm() {
  formOpen.value = false
  editingId.value = ''
  resetForm()
}

function sourceKeyFor(item) {
  if (item.card_id) return `card:${item.card_id}`
  if (item.account_id) return `account:${item.account_id}`
  if (item.payment_method_type === 'benefit') return `benefit:${item.benefit_id || ''}`
  return `${item.payment_method_type || 'other'}:`
}

function payloadFromForm() {
  const [type, id = ''] = String(form.sourceKey || 'other:').split(':')
  return {
    name: form.name,
    provider: form.provider || form.name,
    category: form.category,
    amount: Number(form.amount || 0),
    billing_cycle: form.billing_cycle,
    billing_interval: Number(form.billing_interval || 1),
    next_billing_date: form.next_billing_date,
    started_at: form.started_at || null,
    status: form.status,
    payment_method_type: type || 'other',
    card_id: type === 'card' ? id : null,
    account_id: type === 'account' ? id : null,
    reminder_days: Number(form.reminder_days || 0),
    is_essential: Boolean(form.is_essential),
    notes: form.notes,
    url: form.url,
  }
}

function submitForm() {
  if (Number(form.amount || 0) < 0) {
    showToast('Informe um valor válido.', 'warning')
    return
  }
  if (editingId.value) {
    financeStore.updateSubscription(editingId.value, payloadFromForm())
    showToast('Assinatura atualizada.', 'success')
  } else {
    financeStore.addSubscription(payloadFromForm())
    showToast('Assinatura cadastrada.', 'success')
  }
  editingId.value = ''
  resetForm()
  formOpen.value = false
}

function quickPause(item) {
  financeStore.pauseSubscription(item.id)
  showToast('Assinatura pausada. Ela saiu das previsões futuras.', 'info')
}

function quickCancel(item) {
  financeStore.cancelSubscription(item.id)
  showToast('Assinatura cancelada logicamente.', 'info')
}

function askDelete(item) {
  deleteTarget.value = item
}

function confirmDelete() {
  if (!deleteTarget.value) return
  financeStore.softDeleteSubscription(deleteTarget.value.id)
  showToast('Assinatura excluída da visão ativa.', 'success')
  deleteTarget.value = null
}

function toggleActionMenu(id) {
  openActionMenuId.value = openActionMenuId.value === id ? '' : id
}

function closeActionMenu() {
  openActionMenuId.value = ''
}

function editFromMenu(item) {
  closeActionMenu()
  startEdit(item)
}

function pauseFromMenu(item) {
  closeActionMenu()
  quickPause(item)
}

function cancelFromMenu(item) {
  closeActionMenu()
  quickCancel(item)
}

function deleteFromMenu(item) {
  closeActionMenu()
  askDelete(item)
}

function chargesFor(subscriptionId) {
  return (financeStore.state.subscriptionCharges || [])
    .filter((charge) => charge.subscription_id === subscriptionId)
    .sort((a, b) => new Date(b.charged_at) - new Date(a.charged_at))
}

function statusLabel(status) {
  return statusOptions.find((item) => item.value === status)?.label || status
}

function statusBadgeClass(status) {
  return `status-${status || 'active'}`
}

function servicePresentation(item) {
  const match = suggestKnownService(`${item?.provider || ''} ${item?.name || ''}`)
  if (match) return match
  const name = String(item?.provider || item?.name || 'Assinatura').trim()
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase() || 'A'
  return {
    provider: name,
    logo: initials,
    color: 'var(--accent)',
    background: 'var(--blue-dim)',
    cancelUrl: normalizeExternalUrl(item?.url),
  }
}

function serviceLogoStyle(item) {
  const presentation = servicePresentation(item)
  return {
    '--service-logo-color': presentation.color || 'var(--accent)',
    '--service-logo-bg': presentation.background || 'var(--blue-dim)',
  }
}

function cancellationLinkFor(item) {
  return normalizeExternalUrl(servicePresentation(item).cancelUrl || item?.url)
}

function cycleLabel(cycle) {
  return cycleOptions.find((item) => item.value === cycle)?.label || cycle
}

function sourceLabel(item) {
  if (item.card_id) return financeStore.state.creditCards.find((card) => card.id === item.card_id)?.name || 'Cartão'
  if (item.account_id) return financeStore.state.financialAccounts.find((account) => account.id === item.account_id)?.name || 'Conta'
  if (item.payment_method_type === 'benefit') return 'Benefício'
  return 'Outro'
}

function formatMoney(value) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
    .format(Number(value || 0))
    .replace(/\s+/g, ' ')
}

function parseLocalDate(value) {
  const [year, month, day] = String(value || referenceDate.value).split('-').map(Number)
  return new Date(year, month - 1, day, 12, 0, 0, 0)
}

function addDaysIso(value, days) {
  const date = parseLocalDate(value)
  date.setDate(date.getDate() + days)
  return date.toISOString().split('T')[0]
}

function dateDiffDays(from, to) {
  return Math.round((parseLocalDate(to) - parseLocalDate(from)) / DAY_MS)
}

function formatDate(value) {
  if (!value) return 'sem data'
  return parseLocalDate(value).toLocaleDateString('pt-BR')
}

function formatShortDate(value) {
  return parseLocalDate(value).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
}

function relativeBillingText(daysUntil) {
  if (daysUntil <= 0) return 'Hoje'
  if (daysUntil === 1) return 'Amanhã'
  if (daysUntil < 31) return `Em ${daysUntil} dias`
  const months = Math.max(1, Math.round(daysUntil / 30))
  return `Em ${months} ${months === 1 ? 'mês' : 'meses'}`
}

function normalizeSuggestionText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

function subscriptionCardTestId(item) {
  const slug = normalizeSuggestionText(item?.name || item?.id).replace(/\s+/g, '-')
  return `subscription-card-${slug || item?.id || 'item'}`
}

function suggestKnownService(value) {
  const text = normalizeSuggestionText(value)
  if (!text) return null
  return SERVICE_SUGGESTIONS.find((service) => (
    service.terms.some((term) => text.includes(normalizeSuggestionText(term)))
  )) || null
}

function impactPercent(value) {
  if (!impactDistributionTotal.value) return 0
  return Math.min(100, Math.round((Number(value || 0) / impactDistributionTotal.value) * 100))
}
</script>

<style scoped>
.primary-button,
.secondary-button {
  min-height: 40px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.45rem;
  border-radius: 8px;
  padding: 0.65rem 0.9rem;
  font-weight: 800;
  cursor: pointer;
}

.primary-button {
  border: 0;
  background: var(--accent);
  color: #fff;
}

.secondary-button {
  border: 1px solid var(--border-color);
  background: var(--bg-elevated);
  color: var(--text-primary);
}

.subscriptions-layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(300px, 360px);
  gap: 1rem;
  align-items: start;
}

.content-column,
.side-column {
  min-width: 0;
  display: grid;
  gap: 1rem;
}

.side-column {
  position: sticky;
  top: calc(68px + 1rem);
}

.kpi-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 1rem;
}

.kpi-card,
.panel {
  min-width: 0;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-lg);
  background: transparent;
  box-shadow: none;
}

.kpi-card {
  min-height: 132px;
  padding: 1.05rem;
  display: grid;
  align-content: space-between;
  gap: 0.5rem;
  overflow: hidden;
}

.kpi-card span,
.kpi-card small,
.panel-head p,
.subscription-main p,
.subscription-main small,
.charge-history,
.empty-inline,
dt {
  color: var(--text-secondary);
}

.kpi-card span {
  font-size: var(--text-xs);
  font-weight: 800;
  letter-spacing: var(--eyebrow-letter-spacing);
  text-transform: uppercase;
}

.kpi-card strong {
  color: var(--text-primary);
  font-size: 1.45rem;
  letter-spacing: 0;
}

.panel {
  padding: 1.05rem;
}

.panel-head {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 0.85rem;
}

.panel-head.compact {
  margin-bottom: 0.5rem;
}

.panel-head h2,
.category-group h3 {
  margin: 0;
  color: var(--text-primary);
  font-size: 1rem;
}

.panel-head p {
  margin: 0.2rem 0 0;
  font-size: 0.82rem;
}

.filters-head {
  align-items: flex-start;
}

.filters {
  max-width: 620px;
  display: grid;
  grid-template-columns: repeat(4, minmax(120px, 1fr));
  gap: 0.5rem;
}

select,
input,
textarea {
  width: 100%;
  min-height: 42px;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  background: var(--bg-input);
  color: var(--text-primary);
  padding: 0.55rem 0.65rem;
}

textarea {
  resize: vertical;
}

.alert-list,
.category-groups,
.subscription-form,
.insight-panel dl {
  display: grid;
  gap: 0.75rem;
}

.alert-row,
.subscription-row,
.insight-panel dl div {
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  background: color-mix(in srgb, var(--bg-panel) 76%, var(--bg-hover));
}

.alert-row {
  padding: 0.75rem;
  display: grid;
  gap: 0.25rem;
}

.alert-row.warning { border-color: color-mix(in srgb, var(--warning) 35%, var(--border-color)); }
.alert-row.opportunity { border-color: color-mix(in srgb, var(--income) 30%, var(--border-color)); }
.alert-row.info { border-color: color-mix(in srgb, var(--info) 25%, var(--border-color)); }

.category-group {
  display: grid;
  gap: 0.65rem;
}

.category-group > header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 0.2rem 0;
}

.category-group > header span {
  color: var(--accent);
  font-weight: 800;
}

.subscription-row {
  padding: 0.95rem;
  display: grid;
  gap: 0.7rem;
  transition: border-color 0.16s ease, box-shadow 0.16s ease, transform 0.16s ease;
}

.subscription-row:hover {
  border-color: var(--divider-strong);
  box-shadow: none;
}

.subscription-card-top {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 1rem;
}

.subscription-identity {
  min-width: 0;
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
}

.service-logo-tile {
  width: 48px;
  height: 48px;
  flex: 0 0 48px;
  display: grid;
  place-items: center;
  border: 1px solid color-mix(in srgb, var(--service-logo-color) 28%, var(--border-color));
  border-radius: var(--radius-md);
  background: var(--service-logo-bg);
  color: var(--service-logo-color);
  font-size: 0.8rem;
  font-weight: 950;
  letter-spacing: 0;
  box-shadow: inset 0 0 0 1px color-mix(in srgb, #fff 24%, transparent);
}

.subscription-main {
  min-width: 0;
  display: grid;
  gap: 0.25rem;
}

.row-title {
  display: flex;
  align-items: center;
  gap: 0.45rem;
  flex-wrap: wrap;
}

.row-title strong {
  color: var(--text-primary);
  font-size: 0.98rem;
}

.status-badge,
.essential-badge {
  min-height: 24px;
  display: inline-flex;
  align-items: center;
  border-radius: 999px;
  padding: 0.2rem 0.5rem;
  font-size: 0.7rem;
  font-weight: 900;
}

.status-badge.status-active { color: #166534; background: #dcfce7; }
.status-badge.status-trial { color: #1d4ed8; background: #dbeafe; }
.status-badge.status-paused { color: #854d0e; background: #fef3c7; }
.status-badge.status-cancelled,
.status-badge.status-expired { color: #991b1b; background: #fee2e2; }
.essential-badge { color: var(--accent); background: var(--blue-dim); }

.subscription-card-meta {
  display: flex;
  align-items: flex-start;
  gap: 0.45rem;
}

.subscription-amount {
  white-space: nowrap;
  color: var(--text-primary);
  font-size: 1.05rem;
}

.action-menu {
  position: relative;
}

.icon-menu-button {
  width: 38px;
  height: 38px;
  display: grid;
  place-items: center;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  background: color-mix(in srgb, var(--bg-panel) 88%, var(--bg-hover));
  color: var(--text-primary);
  cursor: pointer;
}

.context-menu {
  position: absolute;
  right: 0;
  top: calc(100% + 0.35rem);
  z-index: 20;
  min-width: 160px;
  display: grid;
  gap: 0.2rem;
  padding: 0.35rem;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  background: var(--bg-glass);
  box-shadow: var(--shadow-floating);
  backdrop-filter: blur(14px);
}

.context-menu button,
.context-menu a {
  min-height: 34px;
  display: flex;
  align-items: center;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: var(--text-primary);
  padding: 0.45rem 0.6rem;
  text-align: left;
  cursor: pointer;
  text-decoration: none;
  font-weight: 800;
  font-size: 0.82rem;
}

.context-menu button:hover,
.context-menu a:hover {
  background: var(--bg-elevated);
}

.context-menu button:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.context-menu .danger {
  color: var(--danger);
}

.charge-history {
  border-top: 1px solid var(--border-color);
  padding-top: 0.55rem;
}

.charge-history summary {
  cursor: pointer;
  font-weight: 800;
}

.history-list {
  margin-top: 0.5rem;
  display: grid;
  gap: 0.4rem;
}

.history-list > div {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto auto;
  gap: 0.6rem;
  padding: 0.5rem;
  border-radius: var(--radius-sm);
  background: var(--bg-panel);
}

.form-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.65rem;
}

.subscription-form label {
  display: grid;
  gap: 0.4rem;
  color: var(--text-primary);
  font-size: 0.82rem;
  font-weight: 800;
}

.switch-row {
  display: flex !important;
  align-items: center;
  gap: 0.55rem;
}

.switch-row input {
  width: 18px;
  min-height: 18px;
}

.form-actions {
  display: flex;
  gap: 0.65rem;
}

.form-actions .primary-button {
  flex: 1;
}

.insight-panel dl {
  margin: 0;
}

.insight-panel dl div {
  padding: 0.65rem 0.75rem;
  display: flex;
  justify-content: space-between;
  gap: 1rem;
}

.impact-panel {
  display: grid;
  gap: 0.85rem;
}

.impact-bars {
  display: grid;
  gap: 0.7rem;
}

.impact-bar-row {
  display: grid;
  gap: 0.4rem;
}

.impact-bar-row > div:first-child {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  color: var(--text-secondary);
  font-size: 0.82rem;
  font-weight: 800;
}

.impact-bar-row strong {
  color: var(--text-primary);
}

.impact-bar-track {
  height: 10px;
  overflow: hidden;
  border-radius: 999px;
  background: color-mix(in srgb, var(--bg-panel) 72%, var(--bg-hover));
  border: 1px solid var(--border-color);
}

.impact-bar-fill {
  display: block;
  width: var(--bar-value);
  min-width: 4px;
  max-width: 100%;
  height: 100%;
  border-radius: inherit;
}

.impact-bar-fill.card {
  background: var(--gradient-accent);
}

.impact-bar-fill.account {
  background: var(--income);
}

dt,
dd {
  margin: 0;
}

dd {
  color: var(--text-primary);
  font-weight: 900;
}

.empty-subscriptions {
  min-height: 340px;
  display: grid;
  place-items: center;
  align-content: center;
  gap: 1rem;
  text-align: center;
  background: transparent;
}

.empty-subscriptions h2 {
  margin: 0;
  color: var(--text-primary);
  font-size: 1.1rem;
}

.empty-subscriptions p {
  margin: 0.35rem 0 0;
  color: var(--text-secondary);
}

.empty-illustration {
  position: relative;
  width: 120px;
  height: 92px;
  display: grid;
  place-items: center;
}

.empty-bill {
  position: absolute;
  width: 72px;
  height: 48px;
  border: 1px solid color-mix(in srgb, var(--accent) 30%, var(--border-color));
  border-radius: var(--radius-md);
  background: color-mix(in srgb, var(--bg-panel) 76%, var(--bg-hover));
  box-shadow: none;
}

.empty-bill.one {
  transform: rotate(-8deg) translate(-14px, 3px);
}

.empty-bill.two {
  transform: rotate(8deg) translate(14px, -3px);
}

.empty-dot {
  position: absolute;
  width: 28px;
  height: 28px;
  border-radius: 999px;
  background: var(--gradient-accent);
  box-shadow: var(--shadow-glow);
}

.drawer-layer {
  position: fixed;
  inset: 0;
  z-index: 10020;
  display: flex;
  justify-content: flex-end;
  background: rgba(0, 0, 0, 0.48);
}

.subscription-drawer {
  width: min(540px, 100%);
  height: 100%;
  display: grid;
  grid-template-rows: auto 1fr;
  gap: 0.75rem;
  overflow-y: auto;
  border-left: 1px solid var(--border-strong);
  background: var(--gradient-panel);
  box-shadow: var(--shadow-floating);
  padding: 1rem;
}

.drawer-head {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  align-items: start;
}

.drawer-head h2 {
  margin: 0;
  color: var(--text-primary);
  font-size: 1.15rem;
}

.drawer-head p {
  margin: 0.25rem 0 0;
  color: var(--text-secondary);
  font-size: 0.84rem;
}

.drawer-close {
  width: 38px;
  height: 38px;
  display: grid;
  place-items: center;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  background: var(--bg-elevated);
  color: var(--text-primary);
  cursor: pointer;
  font-size: 1.35rem;
  line-height: 1;
}

.service-suggestion {
  display: flex;
  align-items: center;
  gap: 0.7rem;
  padding: 0.7rem;
  border: 1px solid color-mix(in srgb, var(--accent) 28%, var(--border-color));
  border-radius: 8px;
  background: var(--blue-dim);
}

.service-logo {
  width: 42px;
  height: 42px;
  display: grid;
  place-items: center;
  border-radius: 8px;
  background: var(--bg-panel);
  color: var(--accent);
  font-weight: 900;
}

.service-suggestion strong,
.service-suggestion small {
  display: block;
}

.service-suggestion small {
  margin-top: 0.2rem;
  color: var(--text-secondary);
}

@media (max-width: 1100px) {
  .subscriptions-layout {
    grid-template-columns: 1fr;
  }

  .side-column {
    position: static;
  }
}

@media (max-width: 720px) {
  .kpi-grid,
  .filters,
  .form-row {
    grid-template-columns: 1fr;
  }

  .panel-head,
  .category-group > header,
  .form-actions,
  .subscription-card-top {
    align-items: stretch;
    flex-direction: column;
  }

  .subscription-card-meta {
    justify-content: space-between;
  }

  .history-list > div {
    grid-template-columns: 1fr;
  }

  .drawer-layer {
    align-items: end;
  }

  .subscription-drawer {
    height: min(92vh, 760px);
    border-left: 0;
    border-radius: 12px 12px 0 0;
  }
}
</style>
