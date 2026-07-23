<template>
  <PageShell
    eyebrow="Compartilhamento familiar"
    title="Família"
    description="Gerencie uma família compartilhada com contas reais, lançamentos divididos e dados privados preservados."
    testid="family-page"
  >
    <section class="family-toolbar" data-testid="family-sharing-page">
      <div>
        <strong>Escopo financeiro</strong>
        <span>Dados privados continuam privados. Somente lançamentos marcados como compartilhados aparecem aqui.</span>
      </div>
      <div class="segmented" data-testid="family-dashboard-mode">
        <button type="button" :class="{ active: viewMode === 'mine' }" @click="viewMode = 'mine'">Minha visão</button>
        <button type="button" :class="{ active: viewMode === 'family' }" @click="viewMode = 'family'">Família</button>
      </div>
    </section>

    <section v-if="pendingInvites.length" class="family-panel pending-invites" data-testid="family-pending-invites">
      <div class="panel-head">
        <div>
          <p class="panel-kicker">Convites recebidos</p>
          <h2>Famílias aguardando resposta</h2>
        </div>
      </div>
      <ul class="compact-list">
        <li v-for="invite in pendingInvites" :key="invite.id">
          <div>
            <strong>{{ invite.family?.name || 'Família convidou você' }}</strong>
            <span>{{ roleLabel(invite.role) }} - expira em {{ formatInviteDate(invite.expires_at) }}</span>
          </div>
          <div class="member-actions">
            <button type="button" class="primary-button" :disabled="loading" @click="acceptPendingInvite(invite)">Aceitar</button>
            <button type="button" class="secondary-button" :disabled="loading" @click="declinePendingInvite(invite)">Recusar</button>
          </div>
        </li>
      </ul>
    </section>

    <section v-if="!overview.family" class="family-panel create-panel" data-testid="family-create-group">
      <div>
        <h2>Criar família compartilhada</h2>
        <p>Crie uma casa compartilhada para convidar usuários reais. Nada do seu histórico privado será compartilhado automaticamente.</p>
      </div>
      <form class="inline-form" @submit.prevent="submitFamilyGroup">
        <label>
          Nome da família
          <input v-model.trim="groupForm.name" required autocomplete="off" placeholder="Casa Andrade" />
        </label>
        <button type="submit" class="primary-button" :disabled="loading">Criar família</button>
      </form>
    </section>

    <section v-else class="family-grid">
      <article class="family-panel" data-testid="family-summary-card">
        <p class="panel-kicker">Minha família</p>
        <h2>{{ overview.family.name }}</h2>
        <div class="summary-list">
          <span>{{ activeMembersLabel }}</span>
          <span>Meu papel: {{ roleLabel(currentRole) }}</span>
          <span>{{ viewMode === 'mine' ? 'Minha visão individual' : 'Visão total da família' }}</span>
        </div>
      </article>

      <article class="family-panel" data-testid="family-members-card">
        <div class="panel-head">
          <div>
            <p class="panel-kicker">Membros</p>
            <h2>Usuários da casa</h2>
          </div>
          <button type="button" class="secondary-button" :disabled="loading" @click="loadEverything">Atualizar</button>
        </div>
        <ul class="member-list">
          <li v-for="member in overview.memberships" :key="member.id" :class="{ removed: member.status !== 'active' }">
            <div>
              <strong>{{ memberName(member) }}</strong>
              <span>{{ roleLabel(member.role) }} - {{ member.status }}</span>
            </div>
            <div v-if="canManage && member.role !== 'owner'" class="member-actions">
              <select :value="member.role" @change="changeRole(member, $event.target.value)">
                <option v-for="role in invitableRoles" :key="role.value" :value="role.value">{{ role.label }}</option>
              </select>
              <button type="button" class="danger-button" @click="removeSharedMember(member)">Remover</button>
            </div>
          </li>
        </ul>
      </article>

      <article class="family-panel" data-testid="family-invites-card">
        <p class="panel-kicker">Convites pendentes</p>
        <h2>Convidar usuário</h2>
        <form class="family-form" data-testid="family-invite-form" @submit.prevent="submitInvite">
          <label>
            E-mail
            <input v-model.trim="inviteForm.email" type="email" :disabled="!canManage" required />
          </label>
          <label>
            Papel
            <select v-model="inviteForm.role" :disabled="!canManage">
              <option v-for="role in invitableRoles" :key="role.value" :value="role.value">{{ role.label }}</option>
            </select>
          </label>
          <label>
            Mensagem opcional
            <textarea v-model.trim="inviteForm.message" rows="3" :disabled="!canManage" />
          </label>
          <button type="submit" class="primary-button" :disabled="loading || !canManage">Enviar convite</button>
        </form>
        <p class="muted">Se este e-mail puder receber convite, o acesso ficará disponível pelo link gerado.</p>
        <p v-if="inviteUrl" class="status-message" data-testid="family-invite-url">{{ inviteUrl }}</p>
        <ul v-if="overview.invites.length" class="compact-list">
          <li v-for="invite in overview.invites" :key="invite.id">
            <span>{{ invite.invited_email || invite.email }}</span>
            <strong>{{ roleLabel(invite.role) }}</strong>
          </li>
        </ul>
      </article>

      <article class="family-panel" data-testid="family-shared-entry-card">
        <p class="panel-kicker">Lançamentos compartilhados</p>
        <h2>Novo lançamento</h2>
        <form class="family-form" data-testid="family-shared-entry-form" @submit.prevent="submitSharedEntry">
          <label>
            Descrição
            <input v-model.trim="sharedForm.description" :disabled="!canWrite" required />
          </label>
          <div class="form-row">
            <label>
              Valor
              <input v-model.number="sharedForm.amount" type="number" min="0" step="0.01" :disabled="!canWrite" required />
            </label>
            <label>
              Data
              <input v-model="sharedForm.entry_date" type="date" :disabled="!canWrite" required />
            </label>
          </div>
          <div class="form-row">
            <label>
              Categoria
              <input v-model.trim="sharedForm.category" :disabled="!canWrite" placeholder="Mercado" />
            </label>
            <label>
              Quem pagou
              <select v-model="sharedForm.paid_by_user_id" :disabled="!canWrite">
                <option v-for="member in activeMembers" :key="member.user_id" :value="member.user_id">{{ memberName(member) }}</option>
              </select>
            </label>
          </div>
          <label>
             Divisão
            <select v-model="sharedForm.split_method" :disabled="!canWrite">
              <option v-for="method in splitMethods" :key="method.value" :value="method.value">{{ method.label }}</option>
            </select>
          </label>
          <fieldset class="participant-box">
            <legend>Participantes</legend>
            <label v-for="member in activeMembers" :key="member.user_id" class="inline-check">
              <input v-model="sharedForm.participant_user_ids" type="checkbox" :value="member.user_id" :disabled="!canWrite" />
              <span>{{ memberName(member) }}</span>
            </label>
          </fieldset>
          <label>
             Observações
            <textarea v-model.trim="sharedForm.notes" rows="3" :disabled="!canWrite" />
          </label>
          <button type="submit" class="primary-button" :disabled="loading || !canWrite">Criar lançamento compartilhado</button>
        </form>
      </article>

      <article class="family-panel wide" data-testid="family-shared-entry-list">
        <div class="panel-head">
          <div>
            <p class="panel-kicker">Histórico compartilhado</p>
            <h2>{{ viewMode === 'mine' ? 'Minha visão' : 'Família' }}</h2>
          </div>
          <span class="badge">Compartilhado</span>
        </div>
        <div v-if="!sharedEntries.length" class="empty-state">Nenhum lançamento compartilhado ainda.</div>
        <ul v-else class="entry-list">
          <li v-for="entry in sharedEntries" :key="entry.id">
            <div>
              <strong>{{ entry.description }}</strong>
              <span>
                {{ entry.category || 'Sem categoria' }} - Pago por {{ memberNameByUserId(entry.paid_by_user_id) }} -
                {{ splitLabel(entry.split_method) }}
              </span>
            </div>
            <strong>{{ formatCurrency(displayAmount(entry)) }}</strong>
          </li>
        </ul>
      </article>

      <article class="family-panel" data-testid="family-sharing-settings">
        <p class="panel-kicker">Configurações de compartilhamento</p>
        <h2>Privacidade</h2>
        <p class="muted">
          Receitas, contas, cartões, salário e histórico privado não entram na família. A família vê somente
          lançamentos criados aqui como compartilhados.
        </p>
      </article>
    </section>

    <section class="family-grid local-grid">
      <article class="family-panel">
        <h2>{{ editingId ? 'Editar membro local' : 'Adicionar membro local' }}</h2>
        <form class="family-form" data-testid="family-member-form" @submit.prevent="submitLocalMember">
          <label>
            Nome
            <input v-model.trim="localForm.name" required autocomplete="off" />
          </label>
          <label>
            Relação
            <select v-model="localForm.relationship" required>
              <option v-for="item in relationships" :key="item" :value="item">{{ item }}</option>
            </select>
          </label>
          <label class="inline-check">
            <input v-model="localForm.include_in_analysis" type="checkbox" />
            <span>Participa das análises?</span>
          </label>
          <label>
            Observações
            <textarea v-model.trim="localForm.notes" rows="4" placeholder="Opcional" />
          </label>
          <div class="form-actions">
            <button type="submit" class="primary-button" :disabled="loading">{{ editingId ? 'Salvar membro' : 'Adicionar membro' }}</button>
            <button v-if="editingId" type="button" class="secondary-button" @click="resetLocalForm">Cancelar</button>
          </div>
        </form>
      </article>

      <article class="family-panel">
        <div class="panel-head">
          <div>
            <p class="panel-kicker">Cadastro local</p>
            <h2>Membros cadastrados</h2>
          </div>
          <button type="button" class="secondary-button" :disabled="loading" @click="loadLocalMembers">Atualizar</button>
        </div>
        <div v-if="!localMembers.length" class="empty-state" data-testid="family-empty-state">
          Nenhum membro cadastrado.
        </div>
        <ul v-else class="member-list" data-testid="family-member-list">
          <li v-for="member in localMembers" :key="member.id">
            <div>
              <strong>{{ member.name }}</strong>
              <span>{{ member.relationship }} - {{ member.include_in_analysis ? 'Participa das análises' : 'Fora das análises' }}</span>
              <small v-if="member.notes">{{ member.notes }}</small>
            </div>
            <div class="member-actions">
              <button type="button" class="secondary-button" @click="editLocal(member)">Editar</button>
              <button type="button" class="danger-button" @click="removeLocal(member)">Remover</button>
            </div>
          </li>
        </ul>
      </article>
    </section>

    <p v-if="message" class="status-message" role="status">{{ message }}</p>
    <p v-if="error" class="error-message" role="alert">{{ error }}</p>
  </PageShell>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import PageShell from '@/components/layout/PageShell.vue'
import { getSupabaseClient } from '@/lib/supabase-client.js'
import { useAuthStore } from '@/stores/auth'
import { quantityLabel } from '@/utils/pt-br-copy.js'
import {
  FAMILY_RELATIONSHIPS,
  createUserFamilyMember,
  deleteUserFamilyMember,
  listUserFamilyMembers,
  updateUserFamilyMember,
} from '@/domain/family/userFamilyMembers.js'
import {
  INVITABLE_FAMILY_ROLES,
  SHARED_SPLIT_METHODS,
  canManageFamilyRole,
  canWriteSharedEntries,
  createFamilyGroup,
  createSharedEntry,
  emptyFamilySharingOverview,
  familyDashboardAmount,
  familyRoleLabel,
  acceptFamilyInviteById,
  declineFamilyInviteById,
  fetchPendingFamilyInvites,
  fetchFamilySharingOverview,
  removeFamilyMember,
  sendFamilyInvite,
  splitMethodLabel,
  updateFamilyMemberRole,
} from '@/domain/family/familySharing.js'

const authStore = useAuthStore()
const relationships = FAMILY_RELATIONSHIPS
const invitableRoles = INVITABLE_FAMILY_ROLES
const splitMethods = SHARED_SPLIT_METHODS
const overview = ref(emptyFamilySharingOverview())
const pendingInvites = ref([])
const localMembers = ref([])
const loading = ref(false)
const editingId = ref('')
const message = ref('')
const error = ref('')
const inviteUrl = ref('')
const viewMode = ref('mine')
const groupForm = ref({ name: '' })
const inviteForm = ref({ email: '', role: 'member', message: '' })
const localForm = ref(emptyLocalForm())
const sharedForm = ref(emptySharedForm())

const activeMembers = computed(() => (overview.value.memberships || []).filter((member) => member.status === 'active'))
const activeMembersLabel = computed(() => quantityLabel(activeMembers.value.length, 'membro ativo', 'membros ativos'))
const currentRole = computed(() => overview.value.myMembership?.role || '')
const canManage = computed(() => canManageFamilyRole(currentRole.value))
const canWrite = computed(() => canWriteSharedEntries(currentRole.value))
const sharedEntries = computed(() => overview.value.sharedEntries || [])

function emptyLocalForm() {
  return {
    name: '',
    relationship: relationships[0] || 'Outro',
    include_in_analysis: true,
    notes: '',
  }
}

function emptySharedForm() {
  return {
    description: '',
    amount: null,
    category: '',
    entry_date: new Date().toISOString().slice(0, 10),
    paid_by_user_id: '',
    split_method: 'equal',
    participant_user_ids: [],
    notes: '',
  }
}

async function loadEverything() {
  loading.value = true
  error.value = ''
  try {
    const [sharing] = await Promise.all([
      fetchFamilySharingOverview(),
      loadLocalMembers(),
      loadPendingInvites(),
    ])
    overview.value = sharing
    primeSharedForm()
  } catch (err) {
    error.value = err?.message || 'Não foi possível carregar a família.'
  } finally {
    loading.value = false
  }
}

async function loadPendingInvites() {
  pendingInvites.value = await fetchPendingFamilyInvites().catch(() => [])
}

async function loadLocalMembers() {
  localMembers.value = await listUserFamilyMembers(getSupabaseClient(), authStore.user)
}

function primeSharedForm() {
  const ids = activeMembers.value.map((member) => member.user_id).filter(Boolean)
  if (!sharedForm.value.paid_by_user_id && overview.value.user?.id) sharedForm.value.paid_by_user_id = overview.value.user.id
  if (!sharedForm.value.participant_user_ids.length) sharedForm.value.participant_user_ids = ids
}

async function submitFamilyGroup() {
  await runAction(async () => {
    await createFamilyGroup(groupForm.value.name)
    groupForm.value.name = ''
    message.value = 'Família compartilhada criada.'
    await loadEverything()
  })
}

async function acceptPendingInvite(invite) {
  await runAction(async () => {
    await acceptFamilyInviteById(invite.id)
    message.value = 'Convite familiar aceito.'
    await loadEverything()
  })
}

async function declinePendingInvite(invite) {
  await runAction(async () => {
    await declineFamilyInviteById(invite.id)
    message.value = 'Convite familiar recusado.'
    await loadEverything()
  })
}

async function submitInvite() {
  if (!overview.value.family?.id) return
  await runAction(async () => {
    const result = await sendFamilyInvite({
      familyGroupId: overview.value.family.id,
      email: inviteForm.value.email,
      role: inviteForm.value.role,
      message: inviteForm.value.message,
    })
    inviteUrl.value = result.invite_url || ''
    inviteForm.value = { email: '', role: 'member', message: '' }
    message.value = result.message || 'Convite gerado.'
    await loadEverything()
  })
}

async function submitSharedEntry() {
  if (!overview.value.family?.id) return
  await runAction(async () => {
    await createSharedEntry({
      ...sharedForm.value,
      family_group_id: overview.value.family.id,
    })
    sharedForm.value = emptySharedForm()
    message.value = 'Lançamento compartilhado criado.'
    await loadEverything()
  })
}

async function changeRole(member, role) {
  if (!overview.value.family?.id) return
  await runAction(async () => {
    await updateFamilyMemberRole({ familyGroupId: overview.value.family.id, membershipId: member.id, role })
    message.value = 'Papel atualizado.'
    await loadEverything()
  })
}

async function removeSharedMember(member) {
  if (!overview.value.family?.id) return
  await runAction(async () => {
    await removeFamilyMember({ familyGroupId: overview.value.family.id, membershipId: member.id })
    message.value = 'Membro removido da família compartilhada.'
    await loadEverything()
  })
}

async function submitLocalMember() {
  await runAction(async () => {
    if (editingId.value) {
      await updateUserFamilyMember(getSupabaseClient(), authStore.user, editingId.value, localForm.value)
      message.value = 'Membro local atualizado.'
    } else {
      await createUserFamilyMember(getSupabaseClient(), authStore.user, localForm.value)
      message.value = 'Membro local adicionado.'
    }
    resetLocalForm()
    await loadLocalMembers()
  })
}

function editLocal(member) {
  editingId.value = member.id
  localForm.value = {
    name: member.name,
    relationship: member.relationship,
    include_in_analysis: member.include_in_analysis,
    notes: member.notes || '',
  }
}

async function removeLocal(member) {
  await runAction(async () => {
    await deleteUserFamilyMember(getSupabaseClient(), authStore.user, member.id)
    message.value = 'Membro local removido.'
    if (editingId.value === member.id) resetLocalForm()
    await loadLocalMembers()
  })
}

async function runAction(action) {
  loading.value = true
  message.value = ''
  error.value = ''
  try {
    await action()
  } catch (err) {
    error.value = err?.message || 'Não foi possível concluir a ação.'
  } finally {
    loading.value = false
  }
}

function resetLocalForm() {
  editingId.value = ''
  localForm.value = emptyLocalForm()
}

function memberName(member) {
  if (!member) return 'Membro'
  if (member.user_id === overview.value.user?.id) return 'Você'
  return member.email || `Usuário ${String(member.user_id || '').slice(0, 8)}`
}

function memberNameByUserId(userId) {
  return memberName(activeMembers.value.find((member) => member.user_id === userId))
}

function roleLabel(role) {
  return familyRoleLabel(role)
}

function splitLabel(method) {
  return splitMethodLabel(method)
}

function displayAmount(entry) {
  return familyDashboardAmount(entry, viewMode.value, overview.value.user?.id)
}

function formatCurrency(value) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value || 0))
}

function formatInviteDate(value) {
  if (!value) return 'data pendente'
  return new Date(value).toLocaleDateString('pt-BR')
}

onMounted(loadEverything)
</script>

<style scoped>
.family-toolbar,
.family-panel {
  border: 1px solid var(--divider);
  border-radius: var(--radius-sm);
  background: var(--surface-ledger);
  box-shadow: none;
}

.family-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 1rem;
  margin-bottom: 1rem;
}

.family-toolbar div:first-child,
.summary-list,
.family-panel {
  display: grid;
  gap: .6rem;
}

.family-toolbar span,
.muted,
.empty-state,
.member-list span,
.member-list small,
.entry-list span {
  color: var(--text-secondary);
  line-height: 1.5;
}

.segmented {
  display: inline-flex;
  gap: .35rem;
  padding: .25rem;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  background: var(--bg-input);
}

.segmented button {
  border: 0;
  border-radius: 6px;
  padding: .55rem .8rem;
  background: transparent;
  color: var(--text-secondary);
  font-weight: 900;
}

.segmented button.active {
  background: var(--accent);
  color: #fff;
}

.family-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(280px, 1fr));
  gap: 1rem;
  align-items: start;
  margin-bottom: 1rem;
}

.local-grid {
  margin-top: 1rem;
}

.family-panel {
  padding: 1rem;
}

.family-panel.wide {
  grid-column: 1 / -1;
}

.create-panel {
  margin-bottom: 1rem;
}

.panel-head,
.member-list li,
.entry-list li,
.compact-list li {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
}

.panel-kicker {
  margin: 0;
  color: var(--accent);
  font-family: var(--font-sans);
  font-size: var(--text-xs);
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: var(--eyebrow-letter-spacing);
}

h2,
p {
  margin: 0;
}

.family-form,
.inline-form,
.member-list,
.entry-list,
.compact-list {
  display: grid;
  gap: .85rem;
}

.inline-form {
  grid-template-columns: minmax(220px, 1fr) auto;
  align-items: end;
}

.form-row {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: .85rem;
}

label {
  display: grid;
  gap: .45rem;
  color: var(--text-primary);
  font-weight: 800;
}

input,
select,
textarea {
  width: 100%;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  padding: .75rem .85rem;
  background: var(--bg-input);
  color: var(--text-primary);
}

.inline-check {
  display: flex;
  align-items: center;
  gap: .55rem;
}

.inline-check input {
  width: 18px;
  height: 18px;
}

.participant-box {
  display: grid;
  gap: .55rem;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  padding: .85rem;
}

.participant-box legend {
  padding: 0 .35rem;
  color: var(--text-primary);
  font-weight: 900;
}

.member-list,
.entry-list,
.compact-list {
  margin: 0;
  padding: 0;
  list-style: none;
}

.member-list li,
.entry-list li,
.compact-list li {
  padding: .85rem;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  background: var(--bg-elevated);
}

.member-list li.removed {
  opacity: .62;
}

.member-list div:first-child,
.entry-list div:first-child {
  display: grid;
  gap: .25rem;
}

.member-actions,
.form-actions {
  display: flex;
  gap: .65rem;
  flex-wrap: wrap;
  align-items: center;
}

.primary-button,
.secondary-button,
.danger-button {
  width: fit-content;
  border-radius: 8px;
  padding: .68rem .9rem;
  font-weight: 900;
}

.primary-button {
  border: 0;
  background: var(--accent);
  color: #fff;
}

.secondary-button {
  border: 1px solid var(--border-color);
  background: var(--bg-input);
  color: var(--text-primary);
}

.danger-button {
  border: 1px solid rgba(248, 113, 113, .35);
  background: rgba(248, 113, 113, .08);
  color: #f87171;
}

.badge {
  display: inline-flex;
  width: fit-content;
  border-radius: 999px;
  padding: .35rem .65rem;
  background: var(--blue-dim);
  color: var(--accent);
  font-weight: 900;
}

.status-message {
  color: var(--income);
  font-weight: 800;
  overflow-wrap: anywhere;
}

.error-message {
  color: #f87171;
  font-weight: 800;
}

@media (max-width: 860px) {
  .family-toolbar,
  .panel-head,
  .member-list li,
  .entry-list li,
  .compact-list li {
    align-items: flex-start;
    flex-direction: column;
  }

  .family-grid,
  .inline-form,
  .form-row {
    grid-template-columns: 1fr;
  }
}
</style>
