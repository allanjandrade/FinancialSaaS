<template>
  <div class="family-view">
    <section v-if="needsOnboarding" class="panel onboarding">
      <h2>Conectar família na nuvem (Supabase)</h2>
      <p class="muted">
        Para usar o mesmo financeiro em aparelhos diferentes, crie uma família ou entre com um código de convite.
      </p>
      <div class="onboard-grid">
        <form class="onboard-card" @submit.prevent="createCloudFamily">
          <h3>Criar família</h3>
          <input v-model="onboardFamilyName" placeholder="Ex.: Família Andrade" required />
          <button type="submit" class="primary-button" :disabled="familySync.syncing">Criar na nuvem</button>
        </form>
        <form class="onboard-card" @submit.prevent="joinCloudFamily">
          <h3>Entrar com código</h3>
          <input v-model="onboardInviteCode" placeholder="Código 6 caracteres" maxlength="10" required />
          <input v-model="onboardDisplayName" placeholder="Seu nome" />
          <button type="submit" class="secondary-button" :disabled="familySync.syncing">Entrar na família</button>
        </form>
      </div>
      <p v-if="familySync.syncError" class="error">{{ familySync.syncError }}</p>
    </section>

    <section class="panel hero">
      <div class="hero-row">
        <div>
          <h1>{{ family?.name || 'Família' }}</h1>
          <p>
            Modo família — finanças compartilhadas
            <span v-if="familySync.hasRemoteFamily" class="cloud-badge">Sincronizado na nuvem</span>
          </p>
          <p v-if="familySync.remoteInviteCode" class="invite-code">
            Código da família: <strong>{{ familySync.remoteInviteCode }}</strong>
          </p>
        </div>
        <label class="profile-switch">
          Perfil ativo
          <select :value="currentMemberId" @change="switchMember($event.target.value)">
            <option v-for="m in members" :key="m.id" :value="m.id">
              {{ m.name }} ({{ roleLabel(m.role) }})
            </option>
          </select>
        </label>
      </div>
    </section>

    <div class="tabs">
      <button
        v-for="t in tabs"
        :key="t.id"
        type="button"
        :class="{ active: tab === t.id }"
        @click="tab = t.id"
      >
        {{ t.label }}
      </button>
    </div>

    <!-- Dashboard familiar -->
    <section v-if="tab === 'dashboard'" class="panel">
      <h2>Dashboard familiar</h2>
      <div class="kpi-grid">
        <div class="kpi">
          <span>Receita familiar</span>
          <strong>{{ formatCurrency(dash.familyIncomeTotal) }}</strong>
        </div>
        <div class="kpi">
          <span>Despesas compartilhadas</span>
          <strong>{{ formatCurrency(dash.sharedExpenseTotal) }}</strong>
        </div>
        <div class="kpi">
          <span>Patrimônio total</span>
          <strong>{{ formatCurrency(dash.patrimony.total) }}</strong>
        </div>
        <div class="kpi">
          <span>Saldo projetado</span>
          <strong>{{ formatCurrency(dash.cashFlow.projectedBalance) }}</strong>
        </div>
      </div>

      <h3>Receitas individuais</h3>
      <ul class="stat-list">
        <li v-for="r in dash.individualIncomes" :key="r.memberId">
          {{ r.name }}: {{ formatCurrency(r.total) }}
        </li>
      </ul>

      <h3>Patrimônio</h3>
      <p>Individual: {{ formatCurrency(dash.patrimony.individualTotal) }} · Compartilhado: {{ formatCurrency(dash.patrimony.shared) }}</p>

      <h3>Fluxo de caixa familiar</h3>
      <p>Receitas: {{ formatCurrency(dash.cashFlow.totalIncome) }} · Despesas: {{ formatCurrency(dash.cashFlow.totalExpense) }}</p>
      <p>Compromissos (dívidas/metas): {{ formatCurrency(dash.cashFlow.commitments) }}</p>

      <h3>Simulação de justiça financeira</h3>
      <ul class="stat-list">
        <li v-for="f in dash.fairness" :key="f.memberId">
          {{ f.name }} — renda {{ formatCurrency(f.income) }} → sugestão {{ f.suggestedPercent }}% nas despesas compartilhadas
        </li>
      </ul>
    </section>

    <!-- Membros -->
    <section v-if="tab === 'members'" class="panel">
      <h2>Membros e permissões</h2>
      <form v-if="canInvite" class="form-inline" @submit.prevent="addMember">
        <input v-model="memberForm.name" placeholder="Nome" required />
        <input v-model="memberForm.email" type="email" placeholder="E-mail" />
        <select v-model="memberForm.role">
          <option value="member">Membro</option>
          <option value="administrator">Administrador</option>
          <option value="viewer">Visualizador</option>
        </select>
        <button type="submit" class="secondary-button">Adicionar</button>
      </form>
      <ul class="entity-list">
        <li v-for="m in members" :key="m.id">
          <div>
            <strong>{{ m.name }}</strong>
            <span>{{ roleLabel(m.role) }} · {{ m.email || 'sem e-mail' }}</span>
          </div>
          <select
            v-if="isAdmin && m.id !== currentMemberId"
            :value="m.role"
            @change="updateMemberRole(m, $event.target.value)"
          >
            <option value="administrator">Administrador</option>
            <option value="member">Membro</option>
            <option value="viewer">Visualizador</option>
          </select>
        </li>
      </ul>
      <label class="family-name-edit">
        Nome da família
        <input v-model="familyNameEdit" @change="saveFamilyName" />
      </label>
    </section>

    <!-- Convites -->
    <section v-if="tab === 'invites'" class="panel">
      <h2>Convites</h2>
      <p v-if="familySync.hasRemoteFamily" class="muted">
        Convites reais via Supabase. Jessica abre o link no celular dela (logada) e entra na mesma família.
      </p>
      <form v-if="canInvite" class="form-grid" @submit.prevent="sendInvite">
        <label>E-mail<input v-model="inviteEmail" type="email" placeholder="jessica@email.com" /></label>
        <button type="submit" class="primary-button" :disabled="familySync.syncing">Convidar por e-mail</button>
        <button type="button" class="secondary-button" @click="createLinkInvite">Gerar link / QR</button>
      </form>
      <div v-if="lastInviteLink" class="invite-box">
        <p><strong>Link de convite:</strong></p>
        <code>{{ lastInviteLink }}</code>
        <button type="button" class="secondary-button" @click="copyLink">Copiar link</button>
        <img
          v-if="safeQrUrl"
          :src="safeQrUrl"
          alt="QR Code do convite"
          class="qr"
          width="160"
          height="160"
        />
        <p class="muted">Escaneie o QR no aparelho do convidado (com login feito).</p>
      </div>
      <ul class="entity-list">
        <li v-for="inv in remoteInvites" :key="inv.id">
          {{ inv.email || 'Link' }} — {{ inv.status }}
          <span class="muted">{{ formatDateTime(inv.created_at) }}</span>
        </li>
      </ul>
    </section>

    <!-- Dívidas -->
    <section v-if="tab === 'debts'" class="panel">
      <h2>Dívidas compartilhadas</h2>
      <form class="form-grid" @submit.prevent="submitDebt">
        <label>Nome<input v-model="debtForm.name" required /></label>
        <label>Tipo
          <select v-model="debtForm.type">
            <option v-for="t in debtTypes" :key="t" :value="t">{{ t }}</option>
          </select>
        </label>
        <label>Saldo<input v-model.number="debtForm.balance" type="number" step="0.01" required /></label>
        <label>Parcela mensal<input v-model.number="debtForm.monthlyPayment" type="number" step="0.01" /></label>
        <label>Divisão
          <select v-model="debtForm.splitMode">
            <option value="percent">Por percentual</option>
            <option value="fixed">Por valor fixo</option>
            <option value="shares">Por cotas</option>
          </select>
        </label>
        <button type="submit" class="primary-button">Adicionar dívida</button>
      </form>
      <EmptyState
        v-if="!debts.length"
        :icon="ShieldAlert"
        title="Nenhuma dívida compartilhada"
        description="Cadastre financiamentos ou compromissos familiares para visualizar a divisão entre os membros."
      />
      <article v-for="debt in debts" :key="debt.id" class="sub-card">
        <h3>{{ debt.name }} ({{ debt.type }})</h3>
        <p>Saldo: {{ formatCurrency(debt.balance) }} · Parcela: {{ formatCurrency(debt.monthlyPayment) }}</p>
        <ul>
          <li v-for="row in debtAllocation(debt)" :key="row.memberId">
            {{ memberName(row.memberId) }}: {{ formatCurrency(row.amount) }}
            <span v-if="row.percent">({{ row.percent.toFixed(1) }}%)</span>
          </li>
        </ul>
        <button type="button" class="danger" @click="requestDelete('debt', debt.id, debt.name)">Excluir</button>
      </article>
    </section>

    <!-- Metas -->
    <section v-if="tab === 'goals'" class="panel">
      <h2>Metas compartilhadas</h2>
      <form class="form-grid" @submit.prevent="submitGoal">
        <label>Meta<input v-model="goalForm.name" required /></label>
        <label>Valor alvo<input v-model.number="goalForm.targetAmount" type="number" step="0.01" required /></label>
        <button type="submit" class="primary-button">Criar meta</button>
      </form>
      <EmptyState
        v-if="!goals.length"
        :icon="Target"
        title="Nenhuma meta compartilhada"
        description="Crie uma meta para acompanhar o progresso da família e registrar contribuições."
      />
      <article v-for="g in goals" :key="g.id" class="sub-card">
        <div class="goal-heading">
          <div>
            <h3>{{ g.name }}</h3>
            <p>{{ formatCurrency(g.currentAmount) }} / {{ formatCurrency(g.targetAmount) }}</p>
          </div>
          <span class="goal-status" :class="{ complete: goalProgress(g) >= 100 }">
            {{ goalProgress(g) >= 100 ? 'Atingida' : 'Em andamento' }}
          </span>
        </div>
        <div class="goal-progress" role="progressbar" :aria-valuenow="goalProgress(g)" aria-valuemin="0" aria-valuemax="100">
          <span :style="{ width: `${goalProgress(g)}%` }" />
        </div>
        <form class="form-inline" @submit.prevent="contribute(g.id)">
          <select v-model="contribMemberId">
            <option v-for="m in members" :key="m.id" :value="m.id">{{ m.name }}</option>
          </select>
          <input v-model.number="contribAmount" type="number" step="0.01" placeholder="Valor" />
          <button type="submit" class="secondary-button">Contribuir</button>
        </form>
        <ul v-if="g.contributions?.length">
          <li v-for="(c, i) in g.contributions" :key="i">
            {{ memberName(c.memberId) }}: {{ formatCurrency(c.amount) }}
          </li>
        </ul>
        <button type="button" class="danger" @click="requestDelete('goal', g.id, g.name)">Excluir meta</button>
      </article>
    </section>

    <!-- Acertos -->
    <section v-if="tab === 'settlements'" class="panel">
      <h2>Quem deve para quem</h2>
      <ul v-if="balances.length" class="balance-list">
        <li v-for="b in balances" :key="`${b.fromMemberId}-${b.toMemberId}`">
          <strong>{{ b.fromName }}</strong> deve <strong>{{ b.toName }}</strong>: {{ formatCurrency(b.amount) }}
        </li>
      </ul>
      <p v-else class="muted">Sem saldos internos pendentes.</p>

      <h3>Registrar acerto</h3>
      <form class="form-grid" @submit.prevent="submitSettlement">
        <label>De
          <select v-model="settleForm.fromMemberId">
            <option v-for="m in members" :key="m.id" :value="m.id">{{ m.name }}</option>
          </select>
        </label>
        <label>Para
          <select v-model="settleForm.toMemberId">
            <option v-for="m in members" :key="m.id" :value="m.id">{{ m.name }}</option>
          </select>
        </label>
        <label>Valor<input v-model.number="settleForm.amount" type="number" step="0.01" required /></label>
        <label>Forma
          <select v-model="settleForm.method">
            <option v-for="m in settlementMethods" :key="m" :value="m">{{ m }}</option>
          </select>
        </label>
        <label>Data<input v-model="settleForm.date" type="date" /></label>
        <button type="submit" class="primary-button">Quitar saldo</button>
      </form>
    </section>

    <!-- IA familiar -->
    <section v-if="tab === 'ai'" class="panel">
      <h2>IA familiar</h2>
      <form @submit.prevent="askAi">
        <input v-model="aiQuestion" placeholder="Quanto cada pessoa contribui? Quem deve para quem?" />
        <button type="submit" class="secondary-button">Perguntar</button>
      </form>
      <div class="chips">
        <button v-for="q in quickQuestions" :key="q" type="button" class="chip" @click="aiQuestion = q">{{ q }}</button>
      </div>
      <pre v-if="aiAnswer" class="ai-answer">{{ aiAnswer }}</pre>
    </section>

    <!-- Auditoria -->
    <section v-if="tab === 'audit'" class="panel">
      <h2>Auditoria</h2>
      <EmptyState
        v-if="!auditLog.length"
        :icon="ScrollText"
        title="Nenhuma atividade registrada"
        description="Alterações importantes da família aparecerão aqui com data e responsável."
      />
      <ul v-else class="audit-list">
        <li v-for="a in auditLog" :key="a.id">
          <span class="audit-time">{{ formatDateTime(a.at) }}</span>
          <strong>{{ a.memberName }}</strong> — {{ a.action }} · {{ a.entityType }}
          <p>{{ formatAuditDetails(a.details) }}</p>
        </li>
      </ul>
    </section>

    <ConfirmModal
      :show="pendingDelete != null"
      title="Confirmar exclusão"
      :message="deleteMessage"
      @confirm="confirmDelete"
      @cancel="pendingDelete = null"
    />
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useFinanceStore } from '@/stores/finance'
import { useFamilySyncStore } from '@/stores/family-sync'
import { useNotification } from '@/composables/useNotification'
import ConfirmModal from '@/components/ConfirmModal.vue'
import EmptyState from '@/components/EmptyState.vue'
import { ScrollText, ShieldAlert, Target } from 'lucide-vue-next'
import { formatAuditDetails } from '@/utils/privacy.js'
import {
  DEBT_TYPES,
  SETTLEMENT_METHODS,
  ROLE_LABELS,
} from '@/constants/family.js'
import {
  computeFamilyDashboard,
  computeInternalBalances,
  answerFamilyQuestion,
  allocateSplitAmounts,
  buildInviteLink,
  canPerform,
  memberName as lookupMemberName,
} from '@/utils/family-finance.js'
import { normalizeImageUrl } from '@/utils/safe-url.js'

const financeStore = useFinanceStore()
const familySync = useFamilySyncStore()
const { showToast } = useNotification()
const route = useRoute()

const onboardFamilyName = ref('Família Andrade')
const onboardInviteCode = ref('')
const onboardDisplayName = ref('')
const remoteInvites = ref([])
const qrUrl = ref('')
const safeQrUrl = computed(() => normalizeImageUrl(qrUrl.value))
const pendingDelete = ref(null)
const deleteMessage = computed(() => {
  if (!pendingDelete.value) return ''
  return `Excluir "${pendingDelete.value.label}"? Esta ação não pode ser desfeita.`
})

const needsOnboarding = computed(
  () => familySync.cloudEnabled && !familySync.hasRemoteFamily,
)

const tab = ref('dashboard')
const tabs = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'members', label: 'Membros' },
  { id: 'invites', label: 'Convites' },
  { id: 'debts', label: 'Dívidas' },
  { id: 'goals', label: 'Metas' },
  { id: 'settlements', label: 'Acertos' },
  { id: 'ai', label: 'IA familiar' },
  { id: 'audit', label: 'Auditoria' },
]

const debtTypes = DEBT_TYPES
const settlementMethods = SETTLEMENT_METHODS

const family = computed(() => financeStore.state.family)
const members = computed(() => financeStore.state.familyMembers || [])
const debts = computed(() => financeStore.state.sharedDebts || [])
const goals = computed(() => financeStore.state.sharedGoals || [])
const auditLog = computed(() => [...(financeStore.state.auditLog || [])].reverse().slice(0, 50))

const currentMemberId = computed(() => financeStore.state.settings.currentMemberId)
const currentMember = computed(() => financeStore.getCurrentMember())
const currentUser = computed(() => familySync.membership?.user)
const isAdmin = computed(() => currentMember.value?.role === 'administrator')
const canInvite = computed(() => canPerform(currentMember.value?.role, 'invite') || isAdmin.value)

const month = computed(() => financeStore.state.settings.selectedMonth)
const dash = computed(() =>
  computeFamilyDashboard(financeStore.state, month.value, (m) => financeStore.calcMonth(m)),
)
const balances = computed(() => computeInternalBalances(financeStore.state))

const familyNameEdit = ref(family.value?.name || '')
const memberForm = ref({ name: '', email: '', role: 'member' })
const inviteEmail = ref('')
const lastInviteLink = ref('')
const debtForm = ref({ name: '', type: 'Financiamento', balance: 0, monthlyPayment: 0, splitMode: 'percent' })
const goalForm = ref({ name: '', targetAmount: 0 })
const contribMemberId = ref('')
const contribAmount = ref(0)
const settleForm = ref({
  fromMemberId: '',
  toMemberId: '',
  amount: 0,
  method: 'Pix',
  date: new Date().toISOString().split('T')[0],
})
const aiQuestion = ref('')
const aiAnswer = ref('')

const quickQuestions = [
  'Quanto cada pessoa contribui?',
  'Quem está pagando mais despesas?',
  'Qual é a divisão justa?',
  'Quanto falta para nossa meta?',
  'Quem deve para quem?',
]

async function refreshRemoteInvites() {
  if (!familySync.hasRemoteFamily) return
  try {
    remoteInvites.value = await familySync.listRemoteInvites()
  } catch {
    remoteInvites.value = []
  }
}

onMounted(async () => {
  familyNameEdit.value = family.value?.name || ''
  if (members.value[0]) {
    contribMemberId.value = members.value[0].id
    settleForm.value.fromMemberId = members.value[0].id
    settleForm.value.toMemberId = members.value[1]?.id || members.value[0].id
  }

  const token = route.query.invite
  if (token) {
    try {
      await familySync.acceptRemoteInvite(String(token), onboardDisplayName.value)
      showToast('Convite aceito — dados sincronizados', 'success')
    } catch (err) {
      showToast(err.message || 'Falha ao aceitar convite', 'error')
    }
  }

  await refreshRemoteInvites()
})

watch(
  () => familySync.hasRemoteFamily,
  () => refreshRemoteInvites(),
)

async function createCloudFamily() {
  try {
    await familySync.createRemoteFamily(onboardFamilyName.value)
    showToast('Família criada na nuvem', 'success')
  } catch (err) {
    showToast(err.message || 'Erro ao criar família', 'error')
  }
}

async function joinCloudFamily() {
  try {
    await familySync.joinRemoteByCode(onboardInviteCode.value, onboardDisplayName.value)
    showToast('Você entrou na família', 'success')
  } catch (err) {
    showToast(err.message || 'Código inválido', 'error')
  }
}

function roleLabel(role) {
  return ROLE_LABELS[role] || role
}

function switchMember(id) {
  financeStore.setCurrentMember(id)
}

async function updateMemberRole(member, role) {
  financeStore.updateFamilyMember(member.id, { role })
  if (member.supabaseMemberId && familySync.hasRemoteFamily) {
    try {
      await familySync.changeRemoteMemberRole(member.supabaseMemberId, role)
    } catch (err) {
      showToast(err.message, 'error')
    }
  }
}

function saveFamilyName() {
  financeStore.updateFamily({ name: familyNameEdit.value })
  showToast('Nome atualizado', 'success')
}

async function addMember() {
  if (familySync.hasRemoteFamily && memberForm.value.email) {
    try {
      await familySync.inviteRemote({ email: memberForm.value.email, method: 'email' })
      showToast('Convite enviado por e-mail', 'success')
      await refreshRemoteInvites()
    } catch (err) {
      showToast(err.message, 'error')
    }
  } else {
    financeStore.addFamilyMember({ ...memberForm.value })
    showToast('Membro adicionado localmente', 'success')
    if (familySync.hasRemoteFamily) await familySync.pushNow()
  }
  memberForm.value = { name: '', email: '', role: 'member' }
}

async function sendInvite() {
  if (!inviteEmail.value) return
  try {
    if (familySync.hasRemoteFamily) {
      const inv = await familySync.inviteRemote({ email: inviteEmail.value, method: 'email' })
      lastInviteLink.value = inv.url
      qrUrl.value = `https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(inv.url)}`
      await refreshRemoteInvites()
    } else {
      financeStore.createFamilyInvite({ email: inviteEmail.value, method: 'email' })
    }
    showToast('Convite criado', 'success')
    inviteEmail.value = ''
  } catch (err) {
    showToast(err.message, 'error')
  }
}

async function createLinkInvite() {
  try {
    if (familySync.hasRemoteFamily) {
      const inv = await familySync.inviteRemote({ method: 'link' })
      lastInviteLink.value = inv.url
      qrUrl.value = `https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(inv.url)}`
      await refreshRemoteInvites()
    } else {
      const inv = financeStore.createFamilyInvite({ method: 'link' })
      lastInviteLink.value = buildInviteLink(inv.token)
    }
  } catch (err) {
    showToast(err.message, 'error')
  }
}

function copyLink() {
  navigator.clipboard?.writeText(lastInviteLink.value)
  showToast('Link copiado', 'success')
}

function submitDebt() {
  const splits = members.value.map((m) => ({ memberId: m.id, percent: 100 / members.value.length }))
  financeStore.addSharedDebt({ ...debtForm.value, splits })
  showToast('Dívida cadastrada', 'success')
}

function debtAllocation(debt) {
  return allocateSplitAmounts(debt.balance, debt.splits, debt.splitMode)
}

function submitGoal() {
  financeStore.addSharedGoal({ ...goalForm.value })
  goalForm.value = { name: '', targetAmount: 0 }
  showToast('Meta criada', 'success')
}

function contribute(goalId) {
  financeStore.contributeToGoal(goalId, contribMemberId.value, contribAmount.value)
  contribAmount.value = 0
  showToast('Contribuição registrada', 'success')
}

function goalProgress(goal) {
  const target = Number(goal.targetAmount || 0)
  if (target <= 0) return 0
  return Math.min(100, Math.round((Number(goal.currentAmount || 0) / target) * 100))
}

function requestDelete(type, id, label) {
  pendingDelete.value = { type, id, label }
}

function confirmDelete() {
  const target = pendingDelete.value
  if (!target) return
  if (target.type === 'debt') financeStore.deleteSharedDebt(target.id)
  if (target.type === 'goal') financeStore.deleteSharedGoal(target.id)
  pendingDelete.value = null
  showToast('Item excluído', 'success')
}

function submitSettlement() {
  financeStore.addSettlement({ ...settleForm.value })
  showToast('Acerto registrado', 'success')
}

function askAi() {
  aiAnswer.value = answerFamilyQuestion(
    aiQuestion.value,
    financeStore.state,
    month.value,
    (m) => financeStore.calcMonth(m),
  )
}

function memberName(id) {
  return lookupMemberName(financeStore.state, id)
}

function formatCurrency(v) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0)
}

function formatDateTime(v) {
  return new Date(v).toLocaleString('pt-BR')
}
</script>

<style scoped>
.family-view { padding: 1.5rem; display: grid; gap: 1rem; }
.panel { background: var(--bg-panel); border: 1px solid var(--border-color); border-radius: var(--radius-lg); padding: 1.25rem; }
.hero { background: var(--bg-panel); }
.hero h1 { margin: 0 0 0.35rem; font-family: var(--font-display); font-size: var(--page-title-size); font-weight: var(--page-title-weight); line-height: var(--page-title-line-height); letter-spacing: 0; }
.hero p { margin: 0; color: var(--text-secondary); font-family: var(--font-sans); font-size: var(--page-subtitle-size); line-height: 1.5; }
.hero-row { display: flex; justify-content: space-between; gap: 1rem; flex-wrap: wrap; }
.profile-switch { display: flex; flex-direction: column; gap: 0.35rem; font-size: 0.85rem; }
.tabs { display: flex; flex-wrap: wrap; gap: 0.45rem; }
.tabs button { border: 1px solid var(--border-color); background: var(--bg-hover); padding: 0.4rem 0.75rem; border-radius: 8px; cursor: pointer; }
.tabs button.active { background: var(--accent); color: #fff; border-color: var(--accent); }
.kpi-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 0.75rem; margin: 1rem 0; }
.kpi { background: var(--bg-hover); padding: 0.75rem; border-radius: 8px; }
.kpi span { font-size: 0.75rem; color: var(--text-secondary); }
.stat-list { margin: 0.5rem 0 1rem; padding-left: 1.2rem; }
.form-grid, .form-inline { display: flex; flex-wrap: wrap; gap: 0.6rem; margin-bottom: 1rem; align-items: flex-end; }
label { display: flex; flex-direction: column; gap: 0.3rem; font-size: 0.85rem; }
input, select { padding: 0.55rem; border-radius: 8px; border: 1px solid var(--border-color); background: var(--bg-input); color: var(--text-primary); }
.entity-list { list-style: none; margin: 0; padding: 0; }
.entity-list li { display: flex; justify-content: space-between; padding: 0.6rem 0; border-bottom: 1px solid var(--border-color); font-size: 0.9rem; }
.entity-list span { display: block; color: var(--text-secondary); font-size: 0.8rem; }
.sub-card { background: var(--bg-hover); padding: 0.85rem; border-radius: 8px; margin-top: 0.75rem; }
.goal-heading { display: flex; justify-content: space-between; gap: 1rem; align-items: flex-start; }
.goal-heading h3, .goal-heading p { margin: 0; }
.goal-heading p { margin-top: 0.3rem; color: var(--text-secondary); font-family: var(--font-mono); }
.goal-status { padding: 0.25rem 0.55rem; border-radius: 999px; background: rgba(239, 159, 39, 0.14); color: var(--color-savings, #ef9f27); font-size: 0.72rem; font-weight: 700; }
.goal-status.complete { background: rgba(29, 158, 117, 0.14); color: var(--color-income, #1d9e75); }
.goal-progress { height: 8px; margin: 0.85rem 0; overflow: hidden; border-radius: 999px; background: var(--bg-input); }
.goal-progress span { display: block; height: 100%; border-radius: inherit; background: linear-gradient(90deg, var(--accent), var(--color-income, #1d9e75)); }
.invite-box { background: var(--bg-hover); padding: 0.85rem; border-radius: 8px; margin: 0.75rem 0; }
.invite-box code { word-break: break-all; font-size: 0.8rem; }
.balance-list li { padding: 0.5rem 0; }
.chips { display: flex; flex-wrap: wrap; gap: 0.4rem; margin: 0.5rem 0; }
.chip { border: 1px solid var(--border-color); background: var(--bg-hover); border-radius: 999px; padding: 0.3rem 0.6rem; font-size: 0.78rem; cursor: pointer; }
.ai-answer { white-space: pre-wrap; background: var(--bg-hover); padding: 0.85rem; border-radius: 8px; font-size: 0.88rem; }
.audit-list { list-style: none; margin: 0; padding: 0; max-height: 400px; overflow-y: auto; }
.audit-list li { padding: 0.6rem 0; border-bottom: 1px solid var(--border-color); font-size: 0.85rem; }
.audit-time { color: var(--text-secondary); margin-right: 0.5rem; }
.muted { color: var(--text-secondary); font-size: 0.85rem; }
.danger { color: #ef4444; background: none; border: none; cursor: pointer; }
.family-name-edit { margin-top: 1rem; display: block; }
.onboarding { border-color: rgba(59, 110, 255, 0.35); }
.onboard-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 1rem; margin-top: 1rem; }
.onboard-card { background: var(--bg-hover); padding: 1rem; border-radius: 10px; display: grid; gap: 0.6rem; }
.onboard-card h3 { margin: 0; font-size: 1rem; }
.cloud-badge { font-size: 0.75rem; background: rgba(16, 185, 129, 0.15); color: #10b981; padding: 0.15rem 0.5rem; border-radius: 999px; margin-left: 0.35rem; }
.invite-code { font-size: 0.88rem; color: var(--text-secondary); margin: 0.35rem 0 0; }
.qr { display: block; margin-top: 0.75rem; border-radius: 8px; }
.error { color: #ef4444; font-size: 0.88rem; }
code { font-size: 0.8rem; }
</style>
