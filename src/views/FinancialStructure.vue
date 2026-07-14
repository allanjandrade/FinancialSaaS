<template>
  <div class="structure-view">
    <section class="panel hero">
      <div>
        <nav class="breadcrumb" aria-label="Breadcrumb">Finanças / Gestão financeira</nav>
        <h1>Contas e cartões</h1>
        <p>Gerencie contas, cartões, benefícios e movimentações do seu grupo familiar.</p>
      </div>
      <div v-if="!activeFormVisible && primaryActionAvailable" class="hero-actions">
        <AppButton @click="handlePrimaryAction">
          <Plus aria-hidden="true" :size="16" />
          {{ primaryCtaLabel }}
        </AppButton>
      </div>
    </section>

    <AccountsTabs
      class="accounts-tabs-shell"
      :tabs="tabs"
      :active-tab="activeTab"
      :counts="tabCounters"
      @update:active-tab="handleTabChange"
    />

    <!-- Contas -->
    <section v-if="activeTab === 'accounts'" class="accounts-workspace">
      <div class="accounts-layout" :class="{ 'form-hidden': !accountFormVisible }">
        <aside v-if="accountFormVisible" class="accounts-sidebar">
          <section ref="accountFormPanel" class="panel accounts-entry-panel">
            <header class="accounts-entry-header">
              <div>
                <span>Conta financeira</span>
                <h2>Cadastrar nova conta financeira</h2>
                <p class="muted">Lançamentos vinculados usam essas contas para manter saldos e histórico financeiro consistentes.</p>
              </div>
              <button type="button" class="icon-button small" title="Fechar formulário" @click="accountFormVisible = false">×</button>
            </header>
            <form class="app-form-grid accounts-form-stack" @submit.prevent="submitAccount">
              <AppInput
                v-model="accountForm.name"
                label="Nome da conta"
                placeholder="Exemplo: Conta principal"
                help-text="Use um nome fácil para identificar esta conta no app."
                autofocus
                submit-on-enter
                required
                @enter="submitAccount"
              />
              <AppSelect
                v-model="accountForm.type"
                label="Tipo"
                :options="accountTypeOptions"
              />
              <AppInput
                v-model="accountForm.bank"
                label="Banco"
                placeholder="Exemplo: Santander, Nubank, Itaú"
                help-text="Informe o banco ou instituição, se houver."
              />
              <AppMoneyInput
                v-model="accountForm.balance"
                label="Saldo inicial"
                placeholder="0,00"
                help-text="Deixe em branco se ainda não souber o saldo."
              />
              <div class="app-form-actions accounts-form-actions">
                <AppButton type="submit">Adicionar conta</AppButton>
                <AppButton variant="secondary" type="button" @click="resetAccountForm">Limpar</AppButton>
              </div>
            </form>
          </section>
        </aside>

        <section class="accounts-main">
          <AccountsKpiCards :accounts="accounts" />

          <AccountsActionBar
            v-if="accounts.length || accountCsvPreview.length"
            :selected-count="selectedAccountIds.length"
            :total-count="accounts.length"
            :csv-preview="accountCsvPreview"
            @toggle-bulk="toggleAllAccounts"
            @bulk-activate="handleBulkActivate"
            @bulk-deactivate="handleBulkDeactivate"
            @force-sync="handleForceSync"
            @export-csv="handleExportAccounts"
            @import-csv="handleAccountCsvPreview"
            @clear-preview="clearAccountCsvPreview"
          />

          <AccountsTable
            :accounts="accounts"
            :selected-ids="selectedAccountIds"
            @toggle="toggleAccountSelection"
            @toggle-all="toggleAllAccounts"
            @delete="requestAccountDelete"
            @retry-sync="retryAccountSync"
          >
            <template #empty>
              <div class="accounts-empty-guidance">
                <EmptyState
                  :icon="Landmark"
                  title="Nenhuma conta cadastrada ainda"
                  description="Adicione sua primeira conta para acompanhar saldos, receitas e despesas com mais clareza."
                  action-label="Adicionar conta"
                  compact
                  @action="showAccountForm"
                />
              </div>
            </template>
          </AccountsTable>
        </section>

        <OperationalContextPanel
          class="accounts-context-panel"
          title="Contexto financeiro"
          subtitle="Origens, pendências e próximas ações desta estrutura."
          :items="financialContextItems"
          :alerts="financialContextAlerts"
          empty-message="Adicione sua primeira conta para ativar o contexto financeiro."
        />
      </div>
    </section>

    <!-- Entidades -->
    <section v-if="activeTab === 'entities'" class="panel corporate-panel">
      <h2>Entidades financeiras</h2>
      <p class="muted">Contexto multi-entidade usado para isolamento, permissões e auditoria.</p>
      <ul class="entity-list">
        <li v-for="entity in financialEntities" :key="entity.id">
          <div>
            <strong>{{ entity.legalName || entity.name }}</strong>
            <span>
              {{ entity.name }} · {{ entity.cnpj || 'CNPJ pendente' }} ·
              {{ entity.type === 'business' ? 'Empresa' : 'Grupo familiar' }} · {{ entity.role || currentEntity.role }}
            </span>
          </div>
          <span class="status-chip">Ativa</span>
        </li>
      </ul>
    </section>

    <!-- Integrações -->
    <section v-if="activeTab === 'integrations'" class="panel corporate-panel technical-panel--secondary">
      <h2>Integrações financeiras</h2>
      <p class="muted">Visão operacional das conexões e tentativas de sincronização.</p>
      <EmptyState
        v-if="!accounts.length"
        :icon="PlugZap"
        title="Nenhuma integração"
        description="Cadastre contas para acompanhar origem, status e reprocessamento de sincronização."
        compact
      />
      <ul v-else class="entity-list">
        <li v-for="account in accounts" :key="account.id">
          <div>
            <strong>{{ account.name }}</strong>
            <span>{{ integrationProvider(account) }} · {{ syncStatusLabel(account) }} · {{ account.bank || 'Banco pendente' }}</span>
          </div>
          <button type="button" class="secondary-button" @click="retryAccountSync(account)">Forçar sync</button>
        </li>
      </ul>
    </section>

    <!-- Auditoria -->
    <section v-if="activeTab === 'audit'" class="panel corporate-panel technical-panel--secondary">
      <h2>Auditoria</h2>
      <p class="muted">Últimos eventos locais relacionados à gestão financeira.</p>
      <EmptyState
        v-if="!financialAuditRows.length"
        :icon="ClipboardList"
        title="Sem eventos de auditoria"
        description="Alterações, sincronizações e ações sensíveis aparecerão aqui."
        compact
      />
      <ul v-else class="entity-list audit-list">
        <li v-for="log in financialAuditRows" :key="log.id || `${log.action}-${log.created_at || log.timestamp}`">
          <div>
            <strong>{{ auditActionLabel(log) }}</strong>
            <span>{{ formatAuditTime(log) }} · {{ log.entityType || log.resource_type || 'financeiro' }}</span>
          </div>
          <span class="status-chip">{{ log.action || 'evento' }}</span>
        </li>
      </ul>
    </section>

    <!-- Pendências -->
    <section v-if="activeTab === 'pending'" class="panel corporate-panel technical-panel--secondary">
      <h2>Pendências</h2>
      <p class="muted">Contas que exigem revisão de cadastro, status ou sincronização.</p>
      <EmptyState
        v-if="!pendingAccounts.length"
        :icon="AlertTriangle"
        title="Nenhuma pendência"
        description="Todas as contas têm dados mínimos e status operacional aceitável."
        compact
      />
      <ul v-else class="entity-list">
        <li v-for="account in pendingAccounts" :key="account.id">
          <div>
            <strong>{{ account.name }}</strong>
            <span>{{ pendingReason(account) }}</span>
          </div>
          <button type="button" class="secondary-button" @click="retryAccountSync(account)">Reprocessar</button>
        </li>
      </ul>
    </section>

    <!-- Cartões -->
    <section v-if="activeTab === 'cards'" ref="cardFormPanel" class="panel">
      <h2>Cartões de crédito</h2>
      <form v-if="cardFormVisible" class="card-form" @submit.prevent="submitCard">
        <FormSection title="Identificação" :columns="3">
          <label>Nome do cartão<input ref="cardNameInput" v-model="cardForm.name" required /></label>
          <label>Bandeira
            <select v-model="cardForm.brand">
              <option v-for="b in cardBrands" :key="b" :value="b">{{ b }}</option>
            </select>
          </label>
          <label>Cor / ícone<input v-model="cardForm.color" type="color" /></label>
        </FormSection>

        <FormSection title="Financeiro" :columns="3">
          <label>Limite total<input v-model.number="cardForm.limit" type="number" step="0.01" /></label>
          <label>Limite disponível<input :value="cardForm.limit || 0" type="number" step="0.01" readonly /></label>
          <label>Melhor dia de compra<input :value="bestPurchaseDay" type="number" readonly /></label>
        </FormSection>

        <FormSection title="Datas" :columns="2">
          <label>Dia de vencimento<input v-model.number="cardForm.dueDay" type="number" min="1" max="31" /></label>
          <label>Dia de fechamento<input v-model.number="cardForm.closingDay" type="number" min="1" max="31" /></label>
        </FormSection>

        <FormSection title="Regras adicionais">
          <label>Banco<input v-model="cardForm.bank" /></label>
          <label>Titular
            <select v-model="cardForm.holderMemberId">
              <option v-for="m in members" :key="m.id" :value="m.id">{{ m.name }}</option>
            </select>
          </label>
          <label>Conta vinculada
            <select v-model="cardForm.linkedAccountId">
              <option value="">Nenhuma conta vinculada</option>
              <option v-for="account in accounts" :key="account.id" :value="account.id">{{ account.name }}</option>
            </select>
          </label>
          <label class="checkbox-inline">
            <input v-model="cardForm.active" type="checkbox" />
            Cartão ativo
          </label>
          <label class="checkbox-inline full">
            <input v-model="cardForm.isFamilyCard" type="checkbox" />
            Cartão familiar
          </label>
          <label class="full">Observações<textarea v-model="cardForm.notes" rows="3" /></label>
        </FormSection>

        <footer class="form-actions">
          <button class="primary-button" type="submit">Adicionar cartão</button>
        </footer>
      </form>
      <EmptyState
        v-if="!cards.length && !cardFormVisible"
        :icon="CreditCard"
        title="Nenhum cartão cadastrado"
        description="Cadastre um cartão para acompanhar limite, fechamento e fatura."
        compact
      />
      <article v-for="card in cards" :key="card.id" class="card-item" :style="{ borderLeftColor: card.color }">
        <div>
          <strong>{{ card.name }}</strong>
          <p>{{ card.bank }} · {{ card.brand }} · Limite {{ formatCurrency(card.limit) }}</p>
          <p>Disponível {{ formatCurrency(card.availableLimit) }} · Fech. dia {{ card.closingDay }} · Venc. dia {{ card.dueDay }}
            <span v-if="card.isFamilyCard" class="family-tag"> · Familiar</span>
          </p>
          <p class="holders">
            Portadores:
            <span v-for="h in card.additionalHolders" :key="h.memberId">{{ h.name }} ({{ h.role }})</span>
          </p>
        </div>
        <button type="button" class="secondary-button" @click="addDependent(card)">+ Dependente</button>
        <button type="button" class="danger" @click="requestDelete('card', card.id, card.name)">Excluir</button>
      </article>
    </section>

    <!-- Benefícios -->
    <section v-if="activeTab === 'benefits'" ref="benefitFormPanel" class="panel">
      <h2>Benefícios</h2>
      <form v-if="benefitFormVisible" class="form-grid" @submit.prevent="submitBenefit">
        <label>Nome<input ref="benefitNameInput" v-model="benefitForm.name" required /></label>
        <label>Tipo
          <select v-model="benefitForm.kind">
            <option value="va">Vale Alimentação</option>
            <option value="vr">Vale Refeição</option>
            <option value="corporate">Corporativo</option>
          </select>
        </label>
        <label v-if="benefitForm.kind === 'corporate'">Categoria corporativa
          <select v-model="benefitForm.corporateType">
            <option v-for="c in corporateTypes" :key="c" :value="c">{{ c }}</option>
          </select>
        </label>
        <label>Operadora
          <select v-model="benefitForm.provider">
            <option v-for="p in benefitProviders" :key="p" :value="p">{{ p }}</option>
          </select>
        </label>
        <label>Saldo<input v-model.number="benefitForm.balance" type="number" step="0.01" /></label>
        <label>Recarga mensal<input v-model.number="benefitForm.monthlyRecharge" type="number" step="0.01" /></label>
        <label>Dia recarga<input v-model.number="benefitForm.rechargeDay" type="number" min="1" max="31" /></label>
        <label>Membro
          <select v-model="benefitForm.memberId">
            <option v-for="m in members" :key="m.id" :value="m.id">{{ m.name }}</option>
          </select>
        </label>
        <button class="primary-button" type="submit">Adicionar benefício</button>
      </form>
      <EmptyState
        v-if="!benefits.length && !benefitFormVisible"
        :icon="WalletCards"
        title="Nenhum benefício cadastrado"
        description="Adicione uma carteira VA, VR ou outro benefício para acompanhar recargas e consumo."
        compact
      />
      <ul v-else class="entity-list">
        <li v-for="b in benefits" :key="b.id">
          <div>
            <strong>{{ b.name }}</strong> ({{ kindLabel(b.kind) }})
            <span>{{ b.provider }} · {{ formatCurrency(b.balance) }}</span>
          </div>
          <button type="button" class="danger" @click="requestDelete('benefit', b.id, b.name)">Excluir</button>
        </li>
      </ul>
    </section>

    <!-- Família -->
    <section v-if="activeTab === 'family'" ref="memberFormPanel" class="panel">
      <h2>Centro familiar</h2>
      <form v-if="memberFormVisible" class="form-inline" @submit.prevent="submitMember">
        <input ref="memberNameInput" v-model="memberForm.name" placeholder="Nome" required />
        <button class="secondary-button" type="submit">Adicionar membro</button>
      </form>
      <ul class="entity-list">
        <li v-for="m in members" :key="m.id">
          <strong>{{ m.name }}</strong>
          <button v-if="members.length > 1" type="button" class="danger" @click="requestDelete('member', m.id, m.name)">Remover</button>
        </li>
      </ul>
      <h3>Receitas recorrentes</h3>
      <form class="form-grid" @submit.prevent="submitRecurring">
        <label>Tipo
          <select v-model="recurringForm.type">
            <option v-for="t in incomeTypes" :key="t" :value="t">{{ t }}</option>
          </select>
        </label>
        <label>Valor<input v-model.number="recurringForm.amount" type="number" step="0.01" required /></label>
        <label>Frequência
          <select v-model="recurringForm.frequency">
            <option v-for="f in frequencies" :key="f" :value="f">{{ f }}</option>
          </select>
        </label>
        <label>Dia<input v-model.number="recurringForm.dayOfMonth" type="number" min="1" max="31" /></label>
        <label>Membro
          <select v-model="recurringForm.memberId">
            <option v-for="m in members" :key="m.id" :value="m.id">{{ m.name }}</option>
          </select>
        </label>
        <button class="secondary-button" type="submit">Adicionar recorrente</button>
      </form>
      <EmptyState
        v-if="!recurring.length"
        :icon="Users"
        title="Nenhuma receita recorrente"
        description="Cadastre salários e outras entradas previsíveis para melhorar as projeções."
      />
      <ul v-else class="entity-list">
        <li v-for="r in recurring" :key="r.id">
          <span>{{ r.type }} — {{ formatCurrency(r.amount) }} ({{ r.frequency }}) · {{ memberName(r.memberId) }}</span>
          <button type="button" class="danger" @click="requestDelete('recurring', r.id, r.type)">Excluir</button>
        </li>
      </ul>
    </section>

    <!-- Transferências -->
    <section v-if="activeTab === 'transfers'" ref="transferFormPanel" class="panel">
      <h2>Transferências internas</h2>
      <p class="muted">Movimentação entre contas sem alterar patrimônio total.</p>
      <form v-if="transferFormVisible" class="form-grid" @submit.prevent="submitTransfer">
        <label>Data<input v-model="transferForm.date" type="date" required /></label>
        <label>Valor<input ref="transferAmountInput" v-model.number="transferForm.amount" type="number" step="0.01" required /></label>
        <label>De (conta)
          <select v-model="transferForm.fromId">
            <option v-for="a in accounts" :key="a.id" :value="a.id">{{ a.name }}</option>
          </select>
        </label>
        <label>Para (conta)
          <select v-model="transferForm.toId">
            <option v-for="a in accounts" :key="a.id" :value="a.id">{{ a.name }}</option>
          </select>
        </label>
        <label class="full">Descrição<input v-model="transferForm.description" /></label>
        <button class="primary-button" type="submit">Registrar e confirmar transferência</button>
      </form>
      <EmptyState
        v-if="!transfers.length && !transferFormVisible"
        :icon="ArrowLeftRight"
        title="Nenhuma transferência interna"
        description="Transferências entre suas contas aparecerão aqui sem alterar o patrimônio total."
        compact
      />
      <ul v-else class="entity-list">
        <li v-for="t in transfers" :key="t.id">
          <span>
            {{ formatDate(t.date) }} — {{ formatCurrency(t.amount) }} — {{ t.description }}
            <small>{{ t.confirmed === false ? 'Marcação desfeita' : 'Transferência confirmada' }}</small>
          </span>
          <button type="button" class="secondary-button" @click="toggleTransferConfirmation(t)">
            {{ t.confirmed === false ? 'Confirmar' : 'Desfazer marcação' }}
          </button>
        </li>
      </ul>
    </section>

    <ConfirmModal
      :show="pendingDelete != null"
      title="Confirmar exclusão"
      :message="deleteMessage"
      destructive
      confirm-label="Excluir item"
      @confirm="confirmDelete"
      @cancel="pendingDelete = null"
    />

    <div v-if="dependentTarget" class="inline-modal-overlay" @click="closeDependentModal">
      <form
        class="inline-modal-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="dependent-modal-title"
        @click.stop
        @keydown.esc="closeDependentModal"
        @submit.prevent="confirmDependent"
      >
        <h3 id="dependent-modal-title">Adicionar dependente</h3>
        <p>Informe o nome do dependente que usará {{ dependentTarget?.name || 'este cartão' }}.</p>
        <label>
          Nome do dependente
          <input ref="dependentNameInput" v-model.trim="dependentName" maxlength="80" required />
        </label>
        <div class="inline-modal-actions">
          <button type="button" class="secondary-button" @click="closeDependentModal">Cancelar</button>
          <button type="submit" class="primary-button" :disabled="!dependentName.trim()">Adicionar</button>
        </div>
      </form>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, nextTick } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useFinanceStore } from '@/stores/finance'
import { useNotification } from '@/composables/useNotification'
import AccountsActionBar from '@/components/financial-accounts/AccountsActionBar.vue'
import AccountsKpiCards from '@/components/financial-accounts/AccountsKpiCards.vue'
import AccountsTable from '@/components/financial-accounts/AccountsTable.vue'
import AccountsTabs from '@/components/financial-accounts/AccountsTabs.vue'
import OperationalContextPanel from '@/components/layout/OperationalContextPanel.vue'
import AppButton from '@/components/ui/AppButton.vue'
import AppInput from '@/components/ui/AppInput.vue'
import AppMoneyInput from '@/components/ui/AppMoneyInput.vue'
import AppSelect from '@/components/ui/AppSelect.vue'
import ConfirmModal from '@/components/ConfirmModal.vue'
import EmptyState from '@/components/EmptyState.vue'
import FormSection from '@/components/layout/FormSection.vue'
import {
  AlertTriangle,
  ArrowLeftRight,
  ClipboardList,
  CreditCard,
  Landmark,
  PlugZap,
  Plus,
  Users,
  WalletCards,
} from 'lucide-vue-next'
import {
  ACCOUNT_TYPES,
  CARD_BRANDS,
  BENEFIT_PROVIDERS_VA,
  BENEFIT_PROVIDERS_VR,
  CORPORATE_BENEFIT_TYPES,
  RECURRING_FREQUENCIES,
  SOURCE_TYPES,
} from '@/constants/financial-structure.js'

const financeStore = useFinanceStore()
const { showToast } = useNotification()
const route = useRoute()
const router = useRouter()

const tabs = [
  { id: 'accounts', label: 'Contas' },
  { id: 'cards', label: 'Cartões' },
  { id: 'entities', label: 'Entidades' },
  { id: 'integrations', label: 'Integrações' },
  { id: 'audit', label: 'Auditoria' },
  { id: 'pending', label: 'Pendências' },
  { id: 'benefits', label: 'Benefícios' },
  { id: 'family', label: 'Família' },
  { id: 'transfers', label: 'Transferências' },
]
const activeTab = ref('accounts')
const pendingDelete = ref(null)
const deleteMessage = computed(() => {
  if (!pendingDelete.value) return ''
  return `Excluir "${pendingDelete.value.label}"? Esta ação não pode ser desfeita.`
})

const validTabIds = tabs.map((t) => t.id)

function normalizeStructureTab(tab) {
  const raw = Array.isArray(tab) ? tab[0] : tab
  return validTabIds.includes(raw) ? raw : 'accounts'
}

watch(
  () => route.query.tab,
  (tab) => {
    activeTab.value = normalizeStructureTab(tab)
  },
  { immediate: true },
)

function handleTabChange(tab) {
  const nextTab = normalizeStructureTab(tab)
  activeTab.value = nextTab
  if (route.query.tab === nextTab) return
  router.replace({
    path: '/structure',
    query: { ...route.query, tab: nextTab },
  }).catch(() => {})
}

const accountTypes = ACCOUNT_TYPES
const accountTypeOptions = computed(() => accountTypes.map((type) => ({ value: type, label: type })))
const cardBrands = CARD_BRANDS
const corporateTypes = CORPORATE_BENEFIT_TYPES
const frequencies = RECURRING_FREQUENCIES
const incomeTypes = financeStore.incomeTypes

const accounts = computed(() => financeStore.state.financialAccounts || [])
const cards = computed(() => financeStore.state.creditCards || [])
const benefits = computed(() => financeStore.state.benefitWallets || [])
const members = computed(() => financeStore.state.familyMembers || [])
const recurring = computed(() => financeStore.state.recurringIncomes || [])
const transfers = computed(() => financeStore.state.internalTransfers || [])
const auditLog = computed(() => financeStore.state.auditLog || [])
const selectedAccountIds = ref([])
const accountCsvPreview = ref([])
const selectedEntityId = ref('')
const accountFormVisible = ref(false)
const cardFormVisible = ref(false)
const benefitFormVisible = ref(false)
const memberFormVisible = ref(false)
const transferFormVisible = ref(false)
const accountFormPanel = ref(null)
const accountNameInput = ref(null)
const accountBalanceInput = ref(null)
const cardFormPanel = ref(null)
const cardNameInput = ref(null)
const dependentTarget = ref(null)
const dependentName = ref('')
const dependentNameInput = ref(null)
const benefitFormPanel = ref(null)
const benefitNameInput = ref(null)
const memberFormPanel = ref(null)
const memberNameInput = ref(null)
const transferFormPanel = ref(null)
const transferAmountInput = ref(null)

const tabCounters = computed(() => ({
  accounts: accounts.value.length,
  cards: cards.value.length,
  entities: financialEntities.value.length,
  integrations: integrationCount.value,
  audit: financialAuditRows.value.length,
  pending: pendingAccounts.value.length,
  benefits: benefits.value.length,
  family: members.value.length,
  transfers: transfers.value.length,
}))

const primaryCtaLabel = computed(() => ({
  accounts: 'Nova conta',
  cards: 'Novo cartão',
  benefits: 'Novo benefício',
  family: 'Adicionar membro',
  transfers: 'Nova transferência',
}[activeTab.value] || 'Novo item'))

const primaryActionAvailable = computed(() =>
  ['accounts', 'cards', 'benefits', 'family', 'transfers'].includes(activeTab.value),
)

const activeFormVisible = computed(() => ({
  accounts: accountFormVisible.value,
  cards: cardFormVisible.value,
  benefits: benefitFormVisible.value,
  family: memberFormVisible.value,
  transfers: transferFormVisible.value,
}[activeTab.value] || false))

const selectedAccounts = computed(() => {
  const selected = new Set(selectedAccountIds.value)
  return accounts.value.filter((account) => selected.has(account.id))
})

const financialEntities = computed(() => entityOptions.value)

const integrationCount = computed(() =>
  accounts.value.filter((account) => integrationProvider(account) !== 'Manual').length,
)

const financialAuditRows = computed(() =>
  [...auditLog.value]
    .filter((log) => ['account', 'finance_states', 'financial_account', 'sync'].includes(log.entityType || log.resource_type || ''))
    .reverse()
    .slice(0, 50),
)

const pendingAccounts = computed(() =>
  accounts.value.filter((account) => {
    const syncStatus = String(account.openFinance?.syncStatus || account.syncStatus || '').toLowerCase()
    const status = String(account.status || '').toLowerCase()
    return account.active === false
      || ['error', 'failed', 'failure', 'sync_error', 'pending', 'syncing'].includes(syncStatus)
      || ['inactive', 'inativa', 'blocked', 'bloqueada', 'suspended', 'suspensa'].includes(status)
      || !hasAccountDocument(account)
  }),
)

const financialContextItems = computed(() => [
  {
    id: 'accounts',
    label: 'Contas ativas',
    value: String(accounts.value.filter((account) => account.active !== false).length),
    hint: 'Origens disponíveis para lançamentos',
    tone: accounts.value.length ? 'success' : 'warning',
  },
  {
    id: 'cards',
    label: 'Cartões cadastrados',
    value: String(cards.value.length),
    hint: 'Usados na previsão de faturas',
    tone: cards.value.length ? 'info' : 'warning',
  },
  {
    id: 'benefits',
    label: 'Benefícios',
    value: String(benefits.value.length),
    hint: 'VA, VR e carteiras corporativas',
    tone: benefits.value.length ? 'success' : 'neutral',
  },
])

const financialContextAlerts = computed(() => {
  const alerts = []
  if (!accounts.value.length) {
    alerts.push({
      id: 'first-account',
      title: 'Comece pela conta principal',
      message: 'Ela organiza saldo, receitas e despesas antes de cartões e benefícios.',
      tone: 'warning',
    })
  }
  if (pendingAccounts.value.length) {
    alerts.push({
      id: 'pending-accounts',
      title: 'Pendências de cadastro',
      message: `${pendingAccounts.value.length} conta${pendingAccounts.value.length > 1 ? 's precisam' : ' precisa'} de revisão.`,
      tone: 'warning',
    })
  }
  return alerts
})

const bestPurchaseDay = computed(() => {
  const closingDay = Number(cardForm.value.closingDay)
  if (!Number.isFinite(closingDay) || closingDay < 1) return 1
  return closingDay >= 31 ? 1 : closingDay + 1
})

const entityOptions = computed(() => {
  const family = financeStore.state.family || {}
  const settings = financeStore.state.settings || {}
  const configured = Array.isArray(financeStore.state.financialEntities)
    ? financeStore.state.financialEntities
    : []

  if (configured.length) {
    return configured.map((entity) => ({
      id: entity.id,
      name: entity.name || entity.legalName || entity.legal_name || 'Grupo financeiro',
      legalName: entity.legalName || entity.legal_name || entity.name || '',
      cnpj: entity.cnpj || '',
      type: normalizeEntityType(entity),
      role: entity.role || '',
    }))
  }

  return [{
    id: family.id || 'primary-entity',
    name: family.name || settings.familyName || 'Minha Família',
    legalName: family.legalName || family.legal_name || settings.legalName || '',
    cnpj: family.cnpj || settings.cnpj || '',
    type: normalizeEntityType({ ...family, type: family.type || settings.entityType || settings.entity_type }),
    role: '',
  }]
})

const currentEntity = computed(() => {
  const entity = entityOptions.value.find((item) => String(item.id) === String(selectedEntityId.value))
    || entityOptions.value[0]
  const settings = financeStore.state.settings || {}
  const family = financeStore.state.family || {}
  const currentMember = members.value.find((member) => member.id === settings.currentMemberId) || members.value[0]

  return {
    name: entity?.name || settings.familyName || 'Minha Família',
    legalName: entity?.legalName || family.legalName || family.legal_name || settings.legalName || entity?.name || '',
    cnpj: entity?.cnpj || family.cnpj || settings.cnpj || '',
    type: entity?.type || normalizeEntityType({ ...family, type: family.type || settings.entityType || settings.entity_type }),
    role: financialRoleLabel(entity?.role || currentMember?.financialRole || currentMember?.role || 'admin'),
  }
})

const benefitProviders = computed(() =>
  benefitForm.value.kind === 'vr' ? BENEFIT_PROVIDERS_VR : BENEFIT_PROVIDERS_VA,
)

watch(
  entityOptions,
  (entities) => {
    if (!entities.length) return
    const exists = entities.some((entity) => String(entity.id) === String(selectedEntityId.value))
    if (!selectedEntityId.value || !exists) selectedEntityId.value = entities[0].id
  },
  { immediate: true },
)

watch(
  accounts,
  (nextAccounts) => {
    const validIds = new Set(nextAccounts.map((account) => account.id))
    selectedAccountIds.value = selectedAccountIds.value.filter((id) => validIds.has(id))
  },
  { deep: true },
)

const accountForm = ref({ name: '', type: ACCOUNT_TYPES[0], bank: '', balance: null })
const cardForm = ref({
  name: '', bank: '', brand: 'Visa', limit: 0, closingDay: 25, dueDay: 5,
  holderMemberId: '', color: '#3b6eff', active: true, linkedAccountId: '', notes: '', isFamilyCard: false,
})
const benefitForm = ref({
  name: '', kind: 'va', provider: BENEFIT_PROVIDERS_VA[0], corporateType: CORPORATE_BENEFIT_TYPES[0],
  balance: 0, monthlyRecharge: 0, rechargeDay: 1, memberId: '',
})
const memberForm = ref({ name: '' })
const recurringForm = ref({
  type: 'Salário', amount: 0, frequency: 'Mensal', dayOfMonth: 1, memberId: '',
})
const transferForm = ref({
  date: new Date().toISOString().split('T')[0],
  amount: 0,
  fromId: '',
  toId: '',
  description: '',
})

function submitAccount() {
  financeStore.addFinancialAccount({
    ...accountForm.value,
    balance: accountForm.value.balance ?? 0,
  })
  resetAccountForm()
  showToast('Conta adicionada com sucesso.', 'success')
}

function resetAccountForm() {
  accountForm.value = { name: '', type: ACCOUNT_TYPES[0], bank: '', balance: null }
}

function toggleAccountSelection(id) {
  if (selectedAccountIds.value.includes(id)) {
    selectedAccountIds.value = selectedAccountIds.value.filter((selectedId) => selectedId !== id)
    return
  }

  selectedAccountIds.value = [...selectedAccountIds.value, id]
}

function toggleAllAccounts() {
  if (selectedAccountIds.value.length === accounts.value.length) {
    selectedAccountIds.value = []
    return
  }

  selectedAccountIds.value = accounts.value.map((account) => account.id)
}

function requestAccountDelete(account) {
  requestDelete('account', account.id, account.name)
}

function retryAccountSync(account) {
  showToast(`Sincronização de ${account.name} enviada para reprocessamento`, 'info')
}

function showAccountForm() {
  handleTabChange('accounts')
  accountFormVisible.value = true
  focusPanel(accountFormPanel, accountNameInput)
}

function showInitialBalanceForm() {
  handleTabChange('accounts')
  accountFormVisible.value = true
  accountForm.value.type = 'Dinheiro em Espécie'
  if (!accountForm.value.name) accountForm.value.name = 'Saldo inicial'
  focusPanel(accountFormPanel, accountBalanceInput)
}

function showCardForm() {
  handleTabChange('cards')
  cardFormVisible.value = true
  focusPanel(cardFormPanel, cardNameInput)
}

function showBenefitForm() {
  handleTabChange('benefits')
  benefitFormVisible.value = true
  focusPanel(benefitFormPanel, benefitNameInput)
}

function showMemberForm() {
  handleTabChange('family')
  memberFormVisible.value = true
  focusPanel(memberFormPanel, memberNameInput)
}

function showTransferForm() {
  handleTabChange('transfers')
  transferFormVisible.value = true
  focusPanel(transferFormPanel, transferAmountInput)
}

function handlePrimaryAction() {
  const actions = {
    accounts: () => showAccountForm(),
    cards: () => showCardForm(),
    benefits: () => showBenefitForm(),
    family: () => showMemberForm(),
    transfers: () => showTransferForm(),
  }
  actions[activeTab.value]?.()
}

async function focusPanel(panelRef, inputRef) {
  await nextTick()
  requestAnimationFrame(() => {
    panelRef.value?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    inputRef.value?.focus?.()
  })
}

function handleAccountCsvPreview(payload) {
  accountCsvPreview.value = payload?.rows || []
  showToast(accountCsvPreview.value.length ? 'Preview CSV carregado' : 'CSV sem linhas para preview', 'info')
}

function clearAccountCsvPreview() {
  accountCsvPreview.value = []
}

function handleBulkActivate() {
  patchSelectedAccounts(
    { active: true, status: 'active' },
    (count) => `${count} conta${count > 1 ? 's' : ''} ativada${count > 1 ? 's' : ''}`,
  )
}

function handleBulkDeactivate() {
  patchSelectedAccounts(
    { active: false, status: 'inactive' },
    (count) => `${count} conta${count > 1 ? 's' : ''} desativada${count > 1 ? 's' : ''}`,
  )
}

function handleForceSync() {
  patchSelectedAccounts(
    (account) => ({
      syncStatus: 'pending',
      openFinance: {
        ...(account.openFinance || {}),
        syncStatus: 'pending',
        lastSyncRequestedAt: new Date().toISOString(),
      },
    }),
    (count) => `Sincronização de ${count} conta${count > 1 ? 's' : ''} enviada para reprocessamento`,
  )
}

function handleExportAccounts() {
  const rows = selectedAccounts.value.length ? selectedAccounts.value : accounts.value
  if (!rows.length) {
    showToast('Nenhuma conta para exportar', 'warning')
    return
  }

  const csv = buildAccountsCsv(rows)
  downloadTextFile('contas-financeiras.csv', csv)
  showToast(`Exportação preparada com ${rows.length} conta${rows.length > 1 ? 's' : ''}`, 'success')
}

function patchSelectedAccounts(patch, messageForCount) {
  const targets = selectedAccounts.value
  if (!targets.length) {
    showToast('Selecione ao menos uma conta', 'warning')
    return
  }

  targets.forEach((account) => {
    const nextPatch = typeof patch === 'function' ? patch(account) : patch
    financeStore.updateFinancialAccount(account.id, nextPatch)
  })

  showToast(messageForCount(targets.length), 'success')
}

function submitCard() {
  financeStore.addCreditCard({
    ...cardForm.value,
    holderMemberId: cardForm.value.holderMemberId || members.value[0]?.id,
  })
  cardFormVisible.value = false
  showToast('Cartão adicionado', 'success')
}

function submitBenefit() {
  financeStore.addBenefitWallet({
    ...benefitForm.value,
    memberId: benefitForm.value.memberId || members.value[0]?.id,
  })
  benefitFormVisible.value = false
  showToast('Benefício adicionado', 'success')
}

function submitMember() {
  financeStore.addFamilyMember({ name: memberForm.value.name })
  memberForm.value.name = ''
  memberFormVisible.value = false
  showToast('Membro adicionado', 'success')
}

function submitRecurring() {
  financeStore.addRecurringIncome({
    ...recurringForm.value,
    memberId: recurringForm.value.memberId || members.value[0]?.id,
    sourceAccountId: accounts.value[0]?.id,
  })
  showToast('Recorrente configurado', 'success')
}

function submitTransfer() {
  if (transferForm.value.fromId === transferForm.value.toId) {
    showToast('Selecione contas diferentes', 'warning')
    return
  }
  financeStore.addInternalTransfer({
    date: transferForm.value.date,
    amount: transferForm.value.amount,
    fromType: SOURCE_TYPES.ACCOUNT,
    fromId: transferForm.value.fromId,
    toType: SOURCE_TYPES.ACCOUNT,
    toId: transferForm.value.toId,
    description: transferForm.value.description,
  })
  transferFormVisible.value = false
  showToast('Transferência registrada', 'success')
}

function toggleTransferConfirmation(transfer) {
  const confirmed = transfer.confirmed === false
  financeStore.setInternalTransferConfirmation(transfer.id, confirmed)
  showToast(confirmed ? 'Transferência confirmada' : 'Marcação desfeita', 'success')
}

async function addDependent(card) {
  dependentTarget.value = card
  dependentName.value = ''
  await nextTick()
  dependentNameInput.value?.focus?.()
}

function closeDependentModal() {
  dependentTarget.value = null
  dependentName.value = ''
}

function confirmDependent() {
  const card = dependentTarget.value
  const name = dependentName.value.trim()
  if (!card || !name) return

  const member = financeStore.addFamilyMember({ name })
  const holders = [
    ...(card.additionalHolders || []),
    { memberId: member.id, name: member.name, role: 'Dependente' },
  ]
  financeStore.updateCreditCard(card.id, { additionalHolders: holders })
  closeDependentModal()
  showToast('Dependente adicionado ao cartão', 'success')
}

function requestDelete(type, id, label) {
  pendingDelete.value = { type, id, label }
}

function confirmDelete() {
  const target = pendingDelete.value
  if (!target) return

  const handlers = {
    account: financeStore.deleteFinancialAccount,
    card: financeStore.deleteCreditCard,
    benefit: financeStore.deleteBenefitWallet,
    member: financeStore.deleteFamilyMember,
    recurring: financeStore.deleteRecurringIncome,
  }

  handlers[target.type]?.(target.id)
  pendingDelete.value = null
  showToast('Item excluído', 'success')
}

function kindLabel(kind) {
  if (kind === 'va') return 'VA'
  if (kind === 'vr') return 'VR'
  return 'Corporativo'
}

function financialRoleLabel(role) {
  const labels = {
    admin: 'Administrador',
    administrator: 'Administrador',
    'admin role': 'Administrador',
    'administrator role': 'Administrador',
    owner: 'Administrador',
    financeiro_senior: 'Financeiro Sênior',
    controller: 'Controller',
    operador: 'Operador',
    member: 'Operador',
    leitura: 'Leitura',
    viewer: 'Leitura',
    auditor: 'Auditor',
  }
  const normalized = String(role || '').toLowerCase()
  return labels[normalized] || role || 'Leitura'
}

function normalizeEntityType(entity = {}) {
  const explicit = String(entity.type || entity.entityType || entity.entity_type || '').toLowerCase()
  if (explicit === 'business' || explicit === 'empresa' || explicit === 'company') return 'business'
  if (explicit === 'family' || explicit === 'familia' || explicit === 'personal' || explicit === 'pessoal') return 'family'
  return entity.cnpj ? 'business' : 'family'
}

function memberName(id) {
  return members.value.find((m) => m.id === id)?.name || '—'
}

function integrationProvider(account) {
  return account.openFinance?.provider
    || account.openFinance?.institution
    || account.integrationProvider
    || account.provider
    || 'Manual'
}

function syncStatusLabel(account) {
  const status = String(account.openFinance?.syncStatus || account.syncStatus || 'manual').toLowerCase()
  if (['synced', 'success', 'ok', 'connected', 'active'].includes(status)) return 'Sincronizado'
  if (['error', 'failed', 'failure', 'sync_error'].includes(status)) return 'Erro de sync'
  if (['pending', 'syncing', 'processing'].includes(status)) return 'Processando'
  return 'Manual'
}

function hasAccountDocument(account) {
  return Boolean(account.cnpj || account.cpf || account.document || account.taxId || account.tax_id)
}

function pendingReason(account) {
  const syncStatus = syncStatusLabel(account)
  if (!hasAccountDocument(account)) return 'Documento fiscal pendente para isolamento por entidade.'
  if (account.active === false) return 'Conta desativada e fora das rotinas operacionais.'
  if (syncStatus !== 'Manual' && syncStatus !== 'Sincronizado') return syncStatus
  return 'Revisar status operacional da conta.'
}

function auditActionLabel(log) {
  return log.details || log.action || log.event_type || 'Evento financeiro'
}

function formatAuditTime(log) {
  const value = log.created_at || log.timestamp || log.createdAt
  if (!value) return 'Sem data'
  return formatDate(value)
}

function buildAccountsCsv(rows) {
  const headers = ['nome', 'tipo', 'banco', 'saldo', 'status', 'documento', 'pix', 'sincronização']
  const body = rows.map((account) => [
    account.name,
    account.type,
    account.bank,
    account.balance,
    account.status || (account.active === false ? 'inactive' : 'active'),
    account.cnpj || account.cpf || account.document || account.taxId || account.tax_id || '',
    account.pixKey || account.pix_key || account.pix || '',
    syncStatusLabel(account),
  ].map(csvCell).join(','))

  return [headers.join(','), ...body].join('\n')
}

function csvCell(value) {
  const text = String(value ?? '')
  return `"${text.replace(/"/g, '""')}"`
}

function downloadTextFile(filename, content) {
  if (typeof document === 'undefined' || typeof Blob === 'undefined') return
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

function formatCurrency(v) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0)
}

function formatDate(d) {
  return new Date(d).toLocaleDateString('pt-BR')
}
</script>

<style scoped>
.structure-view {
  display: grid;
  gap: 1rem;
  min-height: 100%;
  width: min(var(--content-max), 100%);
  margin: 0 auto;
  padding: var(--content-pad);
  background: transparent;
}

.panel {
  background: var(--gradient-panel);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-lg);
  padding: 1rem;
  box-shadow: var(--shadow-card);
}

.hero {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.85rem;
  border-color: transparent transparent var(--border-color);
  border-radius: 0;
  background: transparent;
  box-shadow: none;
  padding: 0.1rem 0 1rem;
}

.breadcrumb {
  display: block;
  margin-bottom: 0.18rem;
  color: var(--text-muted);
  font-family: var(--font-sans);
  font-size: var(--text-xs);
  font-weight: 700;
  letter-spacing: var(--eyebrow-letter-spacing);
  text-transform: uppercase;
}

.hero h1 {
  margin: 0 0 0.2rem;
  color: var(--text-primary);
  font-family: var(--font-display);
  font-size: clamp(1.45rem, 2vw, 1.85rem);
  font-weight: var(--page-title-weight);
  line-height: var(--page-title-line-height);
  letter-spacing: 0;
}

.hero p {
  margin: 0;
  color: var(--text-secondary);
  font-family: var(--font-sans);
  font-size: var(--page-subtitle-size);
  line-height: 1.45;
}

.hero-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  justify-content: flex-end;
}

.hero-actions button {
  min-height: 34px;
  white-space: nowrap;
}

.accounts-tabs-shell {
  min-width: 0;
}

.accounts-workspace {
  display: grid;
  gap: 1rem;
}

.accounts-layout {
  display: grid;
  grid-template-columns: minmax(300px, 0.32fr) minmax(0, 0.68fr);
  gap: 1rem;
  align-items: start;
}

.accounts-layout.form-hidden {
  grid-template-columns: minmax(0, 1fr) minmax(280px, 0.28fr);
}

.accounts-context-panel {
  position: sticky;
  top: calc(68px + 1rem);
}

.accounts-layout:not(.form-hidden) .accounts-context-panel {
  grid-column: 2;
}

.accounts-sidebar,
.accounts-main {
  min-width: 0;
  display: grid;
  gap: 0.8rem;
  align-content: start;
}

.accounts-entry-panel {
  background: var(--gradient-panel);
  border-color: var(--border-color);
  color: var(--text-primary);
  position: sticky;
  top: calc(68px + 1rem);
}

.accounts-entry-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.25rem;
  margin-bottom: 0.75rem;
}

.accounts-entry-header span {
  color: var(--accent);
  font-size: 0.68rem;
  font-weight: 800;
  letter-spacing: var(--eyebrow-letter-spacing);
  text-transform: uppercase;
}

.accounts-entry-header h2 {
  margin: 0;
  color: var(--text-primary);
  font-size: 1.02rem;
}

.accounts-entry-header .muted {
  margin: 0;
}

.accounts-entry-header .icon-button {
  flex: 0 0 auto;
}

.icon-button {
  width: 34px;
  height: 34px;
  display: inline-grid;
  place-items: center;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  background: var(--bg-elevated);
  color: var(--text-secondary);
  cursor: pointer;
  font-size: 1.1rem;
  font-weight: 800;
  line-height: 1;
}

.icon-button:hover,
.icon-button:focus-visible {
  color: var(--text-primary);
  border-color: var(--border-strong);
}

.accounts-entry-panel label {
  color: var(--text-secondary);
}

.accounts-entry-panel input,
.accounts-entry-panel select {
  border-color: var(--border-color);
  background: var(--bg-input);
  color: var(--text-primary);
  min-height: 42px;
}

.accounts-form-stack {
  grid-template-columns: 1fr;
}

.accounts-form-actions {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.55rem;
}

@media (max-width: 980px) {
  .accounts-layout {
    grid-template-columns: 1fr;
  }

  .accounts-context-panel {
    position: static;
  }

  .accounts-entry-panel {
    position: static;
  }
}

.accounts-form-actions button {
  width: 100%;
}

.accounts-empty-guidance {
  display: grid;
  justify-items: center;
  gap: 0.65rem;
  min-height: 260px;
  padding: 1rem;
  text-align: center;
}

.empty-actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 0.5rem;
}

.empty-link-button {
  min-height: 34px;
  border: 0;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--text-secondary);
  cursor: pointer;
  font-family: var(--font-sans);
  font-size: 0.82rem;
  font-weight: 700;
  text-decoration: underline;
  text-decoration-color: color-mix(in srgb, var(--accent) 45%, transparent);
  text-underline-offset: 4px;
}

.empty-link-button:hover,
.empty-link-button:focus-visible {
  color: var(--text-primary);
  text-decoration-color: var(--accent);
}

.tabs { display: flex; flex-wrap: wrap; gap: 0.5rem; }
.tabs button {
  border: 1px solid var(--border-color);
  background: color-mix(in srgb, var(--bg-panel) 86%, var(--bg-hover));
  padding: 0.45rem 0.85rem;
  border-radius: 8px;
  cursor: pointer;
}
.tabs button.active { background: var(--accent); color: #fff; border-color: var(--accent); }
.tabs button.active { background: var(--gradient-accent); }

.form-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 0.65rem;
  margin-bottom: 0;
}

.card-form {
  display: grid;
  gap: 0.75rem;
  margin-top: 0.75rem;
}

.form-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.55rem;
  margin: 0;
}

.form-grid .full { grid-column: 1 / -1; }
.form-inline { display: flex; gap: 0.5rem; margin-bottom: 1rem; }
label { display: flex; flex-direction: column; gap: 0.3rem; font-size: 0.85rem; }

input,
select,
textarea {
  min-height: 42px;
  padding: 0.62rem 0.72rem;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border-color);
  background: var(--bg-input);
  color: var(--text-primary);
}

textarea {
  min-height: 82px;
  resize: vertical;
}

input[readonly] {
  color: var(--text-secondary);
  background: color-mix(in srgb, var(--bg-input) 72%, var(--bg-hover));
  cursor: default;
}

.entity-list { list-style: none; margin: 0; padding: 0; }
.entity-list li {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.65rem 0;
  border-bottom: 1px solid var(--border-color);
  font-size: 0.9rem;
}
.entity-list span { display: block; color: var(--text-secondary); font-size: 0.82rem; }
.of-tag { font-size: 0.7rem; text-transform: uppercase; color: var(--accent); }
.card-item {
  border-left: 4px solid;
  padding: 0.75rem;
  margin-top: 0.75rem;
  background: color-mix(in srgb, var(--bg-panel) 78%, var(--bg-hover));
  border-radius: var(--radius-md);
  display: grid;
  gap: 0.5rem;
}
.card-item p { margin: 0.2rem 0; font-size: 0.85rem; color: var(--text-secondary); }
.holders span { margin-right: 0.5rem; }
.muted { color: var(--text-secondary); font-size: 0.88rem; }
.checkbox-inline { flex-direction: row; align-items: center; gap: 0.5rem; }
.family-tag { color: #ec4899; font-weight: 600; }
.danger { color: #ef4444; border: none; background: transparent; cursor: pointer; }

.corporate-panel {
  display: grid;
  gap: 0.65rem;
}

.technical-panel--secondary {
  border-style: dashed;
  background: color-mix(in srgb, var(--bg-panel) 76%, var(--bg-hover));
}

.corporate-panel h2 {
  margin: 0;
  color: var(--text-primary);
  font-size: 1rem;
}

.corporate-panel .entity-list li {
  gap: 0.85rem;
}

.status-chip {
  display: inline-flex;
  align-items: center;
  min-height: 28px;
  padding: 0.25rem 0.6rem;
  border: 1px solid color-mix(in srgb, var(--income) 30%, var(--border-color));
  border-radius: 999px;
  background: var(--income-dim);
  color: var(--income);
  font-size: 0.74rem;
  font-weight: 800;
  white-space: nowrap;
}

.audit-list strong {
  color: var(--text-primary);
}

.inline-modal-overlay {
  position: fixed;
  inset: 0;
  z-index: 10000;
  display: grid;
  place-items: center;
  padding: 1rem;
  background: rgba(0, 0, 0, 0.5);
}

.inline-modal-card {
  width: min(420px, 100%);
  display: grid;
  gap: 0.85rem;
  padding: 1.25rem;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-lg);
  background: var(--gradient-panel);
  box-shadow: var(--shadow-floating);
}

.inline-modal-card h3,
.inline-modal-card p {
  margin: 0;
}

.inline-modal-card h3 {
  color: var(--text-primary);
  font-size: 1.05rem;
}

.inline-modal-card p {
  color: var(--text-secondary);
  line-height: 1.5;
}

.inline-modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.55rem;
}

@media (max-width: 720px) {
  .structure-view {
    padding-inline: 0.75rem;
  }

  .hero {
    align-items: flex-start;
    flex-direction: column;
  }

  .hero-actions,
  .hero-actions button {
    width: 100%;
  }

  .accounts-layout {
    grid-template-columns: 1fr;
  }

  .empty-actions,
  .empty-actions button {
    width: 100%;
  }

  .form-actions,
  .form-actions button,
  .accounts-form-actions {
    width: 100%;
    grid-template-columns: 1fr;
  }

  .corporate-panel .entity-list li {
    align-items: stretch;
    flex-direction: column;
  }

  .corporate-panel .secondary-button,
  .status-chip {
    width: 100%;
    justify-content: center;
  }

  .inline-modal-actions {
    display: grid;
  }
}
</style>
