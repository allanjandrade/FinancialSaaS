<template>
  <PageShell
    eyebrow="Sistema"
    title="Admin"
    description="Controle de testers, flags, planos, uso e auditoria com dados sanitizados."
    testid="admin-page"
  >
    <div v-if="!access.is_admin" class="blocked" data-testid="admin-blocked">
      Acesso administrativo indisponível para esta conta.
    </div>
    <section v-else class="admin-panel">
      <nav class="admin-tabs" data-testid="admin-tabs">
        <button v-for="tab in tabs" :key="tab" type="button" :class="{ active: activeTab === tab }" @click="activeTab = tab">{{ tab }}</button>
      </nav>

      <section v-if="activeTab === 'Usuarios'" data-testid="admin-users">
        <h2>Usuarios</h2>
        <p>Role atual: {{ access.role }}</p>
        <button type="button" @click="loadUsers">Atualizar usuários</button>
        <div class="admin-form">
          <label>E-mail do usuário <input v-model="targetEmail" data-testid="admin-target-email" /></label>
          <label>Tipo administrativo
            <select v-model="targetRole" data-testid="admin-target-role">
              <option value="support">Suporte</option>
              <option value="admin">Admin</option>
              <option value="owner">Owner</option>
            </select>
          </label>
          <button type="button" data-testid="set-user-role" @click="setUserRole">Mudar tipo de conta administrativa</button>
        </div>
        <p v-if="usersMessage">{{ usersMessage }}</p>
        <ul class="admin-list">
          <li v-for="user in users" :key="user.id">
            <strong>{{ user.email }}</strong>
            <small>{{ user.id }}</small>
            <span>{{ adminRoleFor(user.id) }}</span>
            <span>{{ planFor(user.id) }}</span>
          </li>
        </ul>
      </section>

      <section v-if="activeTab === 'Testers'" data-testid="admin-testers">
        <h2>Liberar acesso de teste</h2>
        <label>E-mail <input v-model="testerEmail" data-testid="tester-email" /></label>
        <label>Grupo de teste <input v-model="testerGroup" data-testid="tester-group" /></label>
        <label>Data de expiração <input v-model="testerExpires" data-testid="tester-expires" type="date" /></label>
        <button type="button" data-testid="invite-tester" @click="inviteTester">Convidar tester</button>
        <p v-if="testerMessage">{{ testerMessage }}</p>
      </section>

      <section v-if="activeTab === 'Feature flags'" data-testid="admin-feature-flags">
        <h2>Feature flags</h2>
        <div v-for="feature in features" :key="feature">{{ feature }}</div>
      </section>

      <section v-if="activeTab === 'Planos e acessos'" data-testid="admin-entitlements">
        <h2>Planos e acessos</h2>
        <div class="admin-form">
          <label>E-mail do usuário <input v-model="targetEmail" data-testid="plan-target-email" /></label>
          <label>Plano
            <select v-model="targetPlan" data-testid="plan-code">
              <option value="free">Free</option>
              <option value="premium_monthly">Premium mensal</option>
              <option value="premium_annual">Premium anual</option>
            </select>
          </label>
          <button type="button" data-testid="set-user-plan" @click="setUserPlan">Atribuir licença</button>
        </div>
        <p v-if="planMessage">{{ planMessage }}</p>
      </section>

      <section v-if="activeTab === 'Uso'" data-testid="admin-usage">
        <h2>Uso</h2>
        <p>Metricas agregadas sem payload financeiro bruto.</p>
      </section>

      <section v-if="activeTab === 'Auditoria'" data-testid="admin-audit">
        <h2>Auditoria</h2>
        <p>admin_invited_tester</p>
      </section>
    </section>
  </PageShell>
</template>

<script setup>
import { onMounted, ref } from 'vue'
import PageShell from '@/components/layout/PageShell.vue'
import { friendlySupabaseError, invokeAuthenticatedFunction } from '@/lib/supabase-auth.js'
import { quantityLabel } from '@/utils/pt-br-copy.js'

const tabs = ['Usuarios', 'Testers', 'Feature flags', 'Planos e acessos', 'Uso', 'Auditoria']
const features = ['predictive_advisor', 'scenario_simulation', 'price_search', 'automations', 'billing_checkout']
const activeTab = ref('Usuarios')
const testerEmail = ref('tester@example.com')
const testerGroup = ref('release10')
const testerExpires = ref('2026-07-20')
const testerMessage = ref('')
const loadingAccess = ref(true)
const access = ref({ is_admin: false, role: 'user', permissions: [] })
const targetEmail = ref('')
const targetRole = ref('admin')
const targetPlan = ref('premium_monthly')
const users = ref([])
const admins = ref([])
const billing = ref([])
const usersMessage = ref('')
const planMessage = ref('')

onMounted(async () => {
  await loadAccess()
  if (access.value.is_admin) await loadUsers()
})

async function loadAccess() {
  const { data, error } = await invokeAuthenticatedFunction('admin-current-user')
  access.value = error ? { is_admin: false, role: 'user', permissions: [] } : data || { is_admin: false, role: 'user', permissions: [] }
  loadingAccess.value = false
}

async function loadUsers() {
  const { data, error, skipped } = await invokeAuthenticatedFunction('admin-list-users')
  if (error) {
    usersMessage.value = friendlySupabaseError(error, 'Não foi possível carregar usuários.')
    return
  }
  if (skipped) {
    usersMessage.value = 'Faça login para carregar usuários.'
    return
  }
  users.value = data?.users || []
  admins.value = data?.admins || []
  billing.value = data?.billing || []
  usersMessage.value = `${quantityLabel(users.value.length, 'usuário carregado', 'usuários carregados')}.`
}

function adminRoleFor(userId) {
  const admin = admins.value.find((item) => item.user_id === userId)
  if (!admin?.active) return 'usuário'
  return admin.role
}

function planFor(userId) {
  const subscription = billing.value.find((item) => item.user_id === userId)
  return subscription ? `${subscription.plan_code} (${subscription.status})` : 'free'
}

async function setUserRole() {
  const { error } = await invokeAuthenticatedFunction('admin-set-user-role', {
    body: { target_email: targetEmail.value, role: targetRole.value, active: true },
  })
  usersMessage.value = error ? friendlySupabaseError(error, 'Não foi possível alterar o tipo de conta.') : 'Tipo administrativo atualizado.'
  if (!error) await loadUsers()
}

async function setUserPlan() {
  const { error } = await invokeAuthenticatedFunction('admin-set-user-plan', {
    body: { target_email: targetEmail.value, plan_code: targetPlan.value },
  })
  planMessage.value = error ? friendlySupabaseError(error, 'Não foi possível atribuir licença.') : 'Licença atualizada.'
  if (!error) await loadUsers()
}

async function inviteTester() {
  const { data, error } = await invokeAuthenticatedFunction('admin-invite-tester', {
    body: {
      email: testerEmail.value,
      tester_group: testerGroup.value,
      access_expires_at: `${testerExpires.value}T00:00:00Z`,
    },
  })
  testerMessage.value = error ? friendlySupabaseError(error, 'Não foi possível criar convite.') : `Convite criado. Token: ${data?.invite_token || data?.token || 'consulte o log do convite'}`
}
</script>

<style scoped>
.blocked,
.admin-panel {
  padding: 1rem;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  background: var(--bg-panel);
}

.admin-panel {
  display: grid;
  gap: 1rem;
}

.admin-tabs {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.admin-tabs button,
section button {
  border: 1px solid var(--border-color);
  border-radius: 8px;
  padding: 0.6rem 0.8rem;
  background: var(--bg-input);
  color: var(--text-primary);
  font-weight: 800;
}

.admin-tabs button.active,
section button {
  background: var(--accent);
  color: white;
}

section {
  display: grid;
  gap: 0.75rem;
}

label {
  display: grid;
  gap: 0.3rem;
}

input,
select {
  max-width: 360px;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  padding: 0.65rem;
  background: var(--bg-input);
  color: var(--text-primary);
}

.admin-form,
.admin-list {
  display: grid;
  gap: 0.75rem;
}

.admin-list {
  padding: 0;
  list-style: none;
}

.admin-list li {
  display: grid;
  gap: 0.25rem;
  padding: 0.75rem;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  background: var(--bg-input);
}

.admin-list small {
  color: var(--text-muted);
  word-break: break-all;
}
</style>
