<template>
  <header class="topbar">
    <div class="topbar-primary">
      <button class="icon-button mobile-menu" type="button" aria-label="Abrir menu" @click="emit('toggle-mobile-menu')">
        <Menu />
      </button>

      <div v-if="isDashboard" class="frequency-tabs" aria-label="Periodo do dashboard">
        <button
          v-for="period in periods"
          :key="period.value"
          type="button"
          :class="{ active: activePeriod === period.value }"
          @click="setPeriod(period.value)"
        >
          {{ period.label }}
        </button>
      </div>

      <div v-else class="page-heading">
        <span>{{ pageTitle }}</span>
        <small>{{ pageSubtitle }}</small>
      </div>
    </div>

    <div class="topbar-actions">
      <span
        v-if="familySync.hasRemoteFamily"
        class="sync-badge"
        :class="syncBadgeClass"
        :title="syncBadgeTitle"
      >
        <span class="sync-dot" />
        {{ syncBadgeLabel }}
      </span>

      <label class="month-selector" title="Mês de referência">
        <CalendarDays />
        <select v-model="selectedMonth" @change="handleMonthChange">
          <option v-for="(name, index) in monthNames" :key="name" :value="index + 1">
            {{ shortMonth(name) }}/{{ currentYear }}
          </option>
        </select>
      </label>

      <button class="icon-button" type="button" @click="toggleBalance" title="Ocultar ou exibir valores" aria-label="Ocultar ou exibir valores">
        <Eye v-if="!hideBalance" />
        <EyeOff v-else />
      </button>

      <NotificationBell />

      <button class="icon-button export-button" type="button" @click="exportData" :title="exportTitle" :aria-label="exportTitle">
        <Download />
      </button>

      <button class="avatar" type="button" title="Abrir menu da conta" aria-label="Abrir menu da conta" @click="showAccountMenu = !showAccountMenu">
        <UserAvatar :src="profileStore.avatarUrl" :name="userName" :email="authStore.user?.email || ''" size="sm" />
      </button>

      <div v-if="showAccountMenu" class="account-popover">
        <div class="account-summary">
          <UserAvatar :src="profileStore.avatarUrl" :name="userName" :email="authStore.user?.email || ''" size="md" />
          <strong>{{ userName }}</strong>
          <span>{{ authStore.user?.email || 'Conta conectada' }}</span>
        </div>
        <router-link to="/settings" @click="showAccountMenu = false">
          <Settings /> Preferências
        </router-link>
        <router-link to="/family" @click="showAccountMenu = false">
          <Users /> Família
        </router-link>
        <button type="button" @click="showConfirmModal = true; showAccountMenu = false">
          <LogOut /> Sair
        </button>
      </div>
    </div>

    <ConfirmModal
      :show="showConfirmModal"
      title="Confirmar saida"
      message="Deseja realmente sair?"
      @confirm="handleConfirmLogout"
      @cancel="showConfirmModal = false"
    />
  </header>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useFamilySyncStore } from '@/stores/family-sync'
import { useFinanceStore } from '@/stores/finance'
import { useProfileStore } from '@/stores/profileStore.js'
import ConfirmModal from '@/components/ConfirmModal.vue'
import NotificationBell from '@/components/NotificationBell.vue'
import UserAvatar from '@/components/profile/UserAvatar.vue'
import { usePlanAccess } from '@/composables/usePlanAccess.js'
import { metaForPath } from '@/router/navigation.js'
import {
  CalendarDays,
  Download,
  Eye,
  EyeOff,
  LogOut,
  Menu,
  Settings,
  Users,
} from 'lucide-vue-next'

const emit = defineEmits(['toggle-mobile-menu'])
const router = useRouter()
const route = useRoute()
const financeStore = useFinanceStore()
const authStore = useAuthStore()
const familySync = useFamilySyncStore()
const profileStore = useProfileStore()
const planAccess = usePlanAccess()

const showAccountMenu = ref(false)
const showConfirmModal = ref(false)
const selectedMonth = ref(financeStore.state.settings.selectedMonth)
const periods = [
  { label: 'Hoje', value: 'today' },
  { label: 'Semana', value: 'week' },
  { label: 'Mês', value: 'month' },
  { label: 'Ano', value: 'year' },
]

const monthNames = financeStore.monthNames
const currentYear = computed(() => financeStore.state.settings.year)
const hideBalance = computed(() => financeStore.state.settings.hideBalance)
const isDashboard = computed(() => route.path === '/' || route.path === '/dashboard')
const activePeriod = computed(() => {
  const value = String(route.query.period || 'month')
  return periods.some((period) => period.value === value) ? value : 'month'
})

const routeMeta = computed(() => {
  const meta = route.meta?.title ? route.meta : metaForPath(route.path)
  return [meta.title || 'Controle Financeiro', meta.subtitle || 'Organização financeira']
})

const pageTitle = computed(() => routeMeta.value[0])
const pageSubtitle = computed(() => routeMeta.value[1])
const userName = computed(() => profileStore.displayName || authStore.user?.user_metadata?.name || authStore.user?.email?.split('@')[0] || 'Usuário')
const canExportData = computed(() => planAccess.canUse('export_reports'))
const exportTitle = computed(() => canExportData.value ? 'Exportar dados' : 'Exportações Premium')

const syncBadgeClass = computed(() => {
  if (familySync.syncing) return 'syncing'
  if (familySync.isRealtimeConnected) return 'live'
  if (familySync.syncError) return 'error'
  return 'idle'
})

const syncBadgeLabel = computed(() => {
  if (familySync.syncing) return 'Sincronizando'
  if (familySync.isRealtimeConnected) return 'Ao vivo'
  if (familySync.syncError) return 'Erro'
  return 'Nuvem'
})

const syncBadgeTitle = computed(() => familySync.syncError || 'Família conectada à nuvem')

watch(
  () => financeStore.state.settings.selectedMonth,
  (month) => { selectedMonth.value = month },
)

function shortMonth(name) {
  return String(name).slice(0, 3)
}

function setPeriod(period) {
  router.replace({ query: { ...route.query, period } })
}

function handleMonthChange() {
  financeStore.updateSettings({ selectedMonth: Number(selectedMonth.value) })
}

function toggleBalance() {
  financeStore.updateSettings({ hideBalance: !hideBalance.value })
}

function exportData() {
  if (!canExportData.value) {
    router.push({
      path: '/billing',
      query: { locked: '1', feature: 'export_reports', from: route.fullPath },
    })
    return
  }
  const data = JSON.stringify(financeStore.state, null, 2)
  const blob = new Blob([data], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = `controle-financeiro-${new Date().toISOString().split('T')[0]}.json`
  anchor.click()
  URL.revokeObjectURL(url)
}

async function handleConfirmLogout() {
  showConfirmModal.value = false
  await authStore.signOut()
  router.push('/login')
}
</script>

<style scoped>
.topbar {
  position: sticky;
  top: 0;
  z-index: 60;
  min-height: 68px;
  padding: 0 var(--content-pad);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  border-bottom: 1px solid color-mix(in srgb, var(--border-color) 82%, transparent);
  background: var(--bg-glass);
  box-shadow: 0 1px 0 rgba(15, 23, 42, 0.03);
  backdrop-filter: blur(18px);
}

.topbar-primary,
.topbar-actions,
.frequency-tabs,
.month-selector {
  display: flex;
  align-items: center;
}

.topbar-primary,
.topbar-actions {
  gap: 10px;
  min-width: 0;
}

.topbar-actions {
  flex-shrink: 1;
  justify-content: flex-end;
}

.frequency-tabs {
  gap: 2px;
  padding: 3px;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  background: color-mix(in srgb, var(--bg-panel) 76%, var(--bg-hover));
}

.frequency-tabs button {
  min-height: 36px;
  padding: 5px 13px;
  border: 1px solid transparent;
  border-radius: calc(var(--radius-sm) - 1px);
  background: transparent;
  color: var(--text-muted);
  cursor: pointer;
  font-size: var(--text-xs);
  font-weight: 600;
}

.frequency-tabs button:hover {
  color: var(--text-secondary);
}

.frequency-tabs button.active {
  color: var(--accent-hover);
  border-color: color-mix(in srgb, var(--accent) 18%, var(--border-color));
  background: var(--surface-muted);
  box-shadow: none;
}

.page-heading {
  display: grid;
  gap: 1px;
}

.page-heading span {
  color: var(--text-primary);
  font-family: var(--font-sans);
  font-size: var(--text-base);
  font-weight: 700;
  letter-spacing: 0;
}

.page-heading small {
  color: var(--text-muted);
  font-family: var(--font-sans);
  font-size: var(--text-xs);
}

.month-selector {
  min-height: 40px;
  gap: 6px;
  padding: 0 10px;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  color: var(--text-muted);
  background: color-mix(in srgb, var(--bg-panel) 86%, var(--bg-hover));
}

.month-selector svg {
  width: 14px;
}

.month-selector select {
  min-height: 28px;
  padding: 0;
  border: 0;
  background: transparent;
  box-shadow: none;
  color: var(--text-secondary);
  font-size: var(--text-xs);
}

.icon-button,
.avatar {
  width: 42px;
  height: 42px;
  display: grid;
  place-items: center;
  border-radius: var(--radius-sm);
  cursor: pointer;
}

.icon-button {
  border: 1px solid var(--border-color);
  background: color-mix(in srgb, var(--bg-panel) 84%, var(--bg-hover));
  color: var(--text-muted);
}

.icon-button:hover {
  color: var(--accent-hover);
  background: var(--bg-elevated);
  border-color: color-mix(in srgb, var(--accent) 22%, var(--border-color));
}

.icon-button svg {
  width: 15px;
  height: 15px;
}

.mobile-menu {
  display: none;
}

.avatar {
  border: 0;
  background: transparent;
  color: #fff;
}

.sync-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-height: 32px;
  padding: 4px 9px;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-pill);
  color: var(--text-muted);
  font-size: 0.66rem;
  font-weight: 600;
}

.sync-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--text-muted);
}

.sync-badge.live .sync-dot { background: var(--income); box-shadow: 0 0 0 3px var(--income-dim); }
.sync-badge.syncing .sync-dot { background: var(--accent); animation: pulse 1s infinite; }
.sync-badge.error { color: var(--expense); }
.sync-badge.error .sync-dot { background: var(--expense); }

.account-popover {
  position: absolute;
  top: 54px;
  right: 20px;
  width: 220px;
  padding: 8px;
  display: grid;
  gap: 2px;
  border: 1px solid var(--border-strong);
  border-radius: var(--radius-lg);
  background: var(--bg-glass);
  box-shadow: var(--shadow-floating);
  backdrop-filter: blur(16px);
}

.account-summary {
  padding: 8px 9px 11px;
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  border-bottom: 1px solid var(--border-color);
  margin-bottom: 4px;
  column-gap: 0.65rem;
  align-items: center;
}

.account-summary strong { color: var(--text-primary); font-size: 0.78rem; }
.account-summary span { grid-column: 2; color: var(--text-muted); font-size: 0.66rem; overflow: hidden; text-overflow: ellipsis; }

.account-popover a,
.account-popover button {
  min-height: 36px;
  padding: 0 9px;
  display: flex;
  align-items: center;
  gap: 9px;
  border: 0;
  border-radius: 7px;
  background: transparent;
  color: var(--text-secondary);
  text-decoration: none;
  cursor: pointer;
  font-size: 0.76rem;
}

.account-popover a:hover,
.account-popover button:hover { background: var(--bg-elevated); color: var(--text-primary); }
.account-popover svg { width: 15px; }

@keyframes pulse { 50% { opacity: 0.35; } }

@media (max-width: 768px) {
  .topbar { padding: 0 12px; }
  .mobile-menu { display: grid; }
  .frequency-tabs button { padding: 6px 9px; }
  .sync-badge, .export-button { display: none; }
}

@media (max-width: 520px) {
  .topbar {
    gap: 6px;
    padding-inline: 8px;
  }

  .topbar-primary {
    gap: 6px;
  }

  .topbar-actions {
    gap: 4px;
  }

  .page-heading {
    min-width: 0;
  }

  .page-heading small {
    display: none;
  }

  .frequency-tabs { overflow-x: auto; max-width: calc(100vw - 188px); }
  .frequency-tabs button { flex: 0 0 auto; }
  .month-selector svg { display: none; }
  .month-selector {
    min-width: 0;
    padding: 0 5px;
  }
  .month-selector select {
    width: 64px;
    max-width: 64px;
  }

  .icon-button,
  .avatar {
    width: 36px;
    height: 36px;
  }
}
</style>
