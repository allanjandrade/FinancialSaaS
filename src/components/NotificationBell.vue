<template>
  <div class="notification-shell">
    <button
      class="notification-trigger"
      type="button"
      data-testid="notification-bell"
      aria-label="Abrir notificacoes"
      :aria-expanded="open"
      @click="toggle"
    >
      <Bell />
      <span v-if="unreadCount" class="notification-badge">{{ unreadCount }}</span>
    </button>

    <div v-if="open" class="notification-popover" data-testid="notification-list">
      <header>
        <div>
          <strong>Notificacoes</strong>
          <span>{{ unreadSummary }}</span>
        </div>
        <button type="button" aria-label="Atualizar notificacoes" :disabled="loading" @click="load">
          <RefreshCcw />
        </button>
      </header>

      <div v-if="loading" class="notification-empty">Carregando...</div>
      <div v-else-if="!notifications.length" class="notification-empty">Nenhuma notificação.</div>
      <ul v-else>
        <li v-for="notification in notifications" :key="notification.id" :class="{ unread: !notification.read_at }">
          <button type="button" class="notification-row" @click="openNotification(notification)">
            <span class="notification-icon" :class="notification.source">
              <Users v-if="notification.source === 'family'" />
              <Bell v-else />
            </span>
            <span class="notification-copy">
              <strong>{{ notification.title }}</strong>
              <small>{{ notification.message }}</small>
              <em>{{ formatDate(notification.created_at) }}</em>
            </span>
          </button>
          <button
            v-if="!notification.read_at"
            type="button"
            class="mark-read"
            aria-label="Marcar notificação como lida"
            @click.stop="markRead(notification)"
          >
            <Check />
          </button>
        </li>
      </ul>
    </div>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { Bell, Check, RefreshCcw, Users } from 'lucide-vue-next'
import { listNotifications, markNotificationRead } from '@/api/notifications.js'
import { getSupabaseClient } from '@/lib/supabase-client.js'
import { friendlySupabaseError, getActiveSession } from '@/lib/supabase-auth.js'
import { useNotification } from '@/composables/useNotification.js'
import { useAuthStore } from '@/stores/auth'
import { quantityLabel } from '@/utils/pt-br-copy.js'

const router = useRouter()
const { showToast } = useNotification()
const authStore = useAuthStore()
const open = ref(false)
const loading = ref(false)
const notifications = ref([])
let channel = null

const unreadCount = computed(() => notifications.value.filter((item) => !item.read_at).length)
const unreadSummary = computed(() => unreadCount.value ? quantityLabel(unreadCount.value, 'não lida', 'não lidas') : 'Tudo em dia')

async function load() {
  if (!authStore.isAuthenticated) {
    notifications.value = []
    loading.value = false
    return
  }

  loading.value = true
  try {
    notifications.value = await listNotifications(20)
  } catch (error) {
    showToast(friendlySupabaseError(error, 'Não foi possível carregar notificações.'), 'warning')
  } finally {
    loading.value = false
  }
}

function toggle() {
  open.value = !open.value
  if (open.value) load()
}

async function markRead(notification) {
  try {
    const updated = await markNotificationRead(notification.id)
    if (!updated) return
    notifications.value = notifications.value.map((item) => (item.id === updated.id ? updated : item))
  } catch (error) {
    showToast(friendlySupabaseError(error, 'Não foi possível marcar como lida.'), 'warning')
  }
}

async function openNotification(notification) {
  if (!notification.read_at) await markRead(notification)
  const action = notification.payload?.action
  if (action === 'family_invite' || action === 'shared_entry_created' || action === 'shared_entry_updated') {
    open.value = false
    router.push('/family')
  }
}

function formatDate(value) {
  if (!value) return ''
  return new Date(value).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }).replace('.', '')
}

function unsubscribe() {
  const supabase = getSupabaseClient()
  if (channel && supabase?.removeChannel) supabase.removeChannel(channel)
  channel = null
}

async function subscribe() {
  unsubscribe()
  const supabase = getSupabaseClient()
  const { session } = await getActiveSession(supabase)
  if (!supabase?.channel || !session?.user) return

  channel = supabase
    .channel(`in-app-notifications:${session.user.id}`)
    .on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'in_app_notifications',
      filter: `user_id=eq.${session.user.id}`,
    }, () => {
      load()
    })
    .subscribe()
}

onMounted(() => {
  if (authStore.isAuthenticated) {
    load()
    subscribe()
  }
})

onBeforeUnmount(() => {
  unsubscribe()
})

watch(
  () => authStore.isAuthenticated,
  (loggedIn) => {
    if (loggedIn) {
      load()
      subscribe()
    } else {
      open.value = false
      loading.value = false
      notifications.value = []
      unsubscribe()
    }
  },
)
</script>

<style scoped>
.notification-shell {
  position: relative;
}

.notification-trigger {
  position: relative;
  width: 40px;
  height: 40px;
  display: grid;
  place-items: center;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--text-muted);
  cursor: pointer;
}

.notification-trigger:hover {
  color: var(--text-secondary);
  background: var(--bg-elevated);
}

.notification-trigger svg {
  width: 16px;
  height: 16px;
}

.notification-badge {
  position: absolute;
  top: -4px;
  right: -4px;
  min-width: 18px;
  height: 18px;
  padding: 0 5px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 999px;
  background: var(--expense);
  color: #fff;
  font-size: 0.65rem;
  font-weight: 900;
}

.notification-popover {
  position: absolute;
  top: 48px;
  right: 0;
  z-index: 80;
  width: min(360px, calc(100vw - 24px));
  max-height: min(520px, calc(100vh - 90px));
  overflow: hidden auto;
  border: 1px solid var(--border-strong);
  border-radius: var(--radius-md);
  background: var(--bg-glass);
  /* Fluid ledger exception: floating notifications popover. */
  box-shadow: var(--shadow-card-hover);
}

header {
  position: sticky;
  top: 0;
  z-index: 1;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 0.85rem;
  border-bottom: 1px solid var(--border-color);
  background: var(--bg-glass);
}

header div {
  display: grid;
  gap: 0.15rem;
}

header strong {
  color: var(--text-primary);
  font-size: 0.86rem;
}

header span,
.notification-empty {
  color: var(--text-muted);
  font-size: 0.72rem;
}

header button,
.mark-read {
  width: 34px;
  height: 34px;
  display: grid;
  place-items: center;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  background: var(--bg-elevated);
  color: var(--text-secondary);
}

header svg,
.mark-read svg {
  width: 14px;
}

ul {
  display: grid;
  margin: 0;
  padding: 0;
  list-style: none;
}

li {
  position: relative;
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  border-bottom: 1px solid var(--border-color);
}

li:last-child {
  border-bottom: 0;
}

li.unread {
  background: color-mix(in srgb, var(--accent) 7%, transparent);
}

.notification-row {
  min-width: 0;
  min-height: 72px;
  padding: 0.75rem;
  display: grid;
  grid-template-columns: 36px minmax(0, 1fr);
  gap: 0.7rem;
  align-items: start;
  border: 0;
  background: transparent;
  color: inherit;
  text-align: left;
  cursor: pointer;
}

.notification-icon {
  width: 34px;
  height: 34px;
  display: grid;
  place-items: center;
  border-radius: var(--radius-sm);
  color: var(--accent);
  background: var(--blue-dim);
}

.notification-icon.family {
  color: var(--income);
  background: var(--income-dim);
}

.notification-icon svg {
  width: 15px;
}

.notification-copy {
  min-width: 0;
  display: grid;
  gap: 0.18rem;
}

.notification-copy strong {
  color: var(--text-primary);
  font-size: 0.78rem;
}

.notification-copy small {
  color: var(--text-secondary);
  line-height: 1.35;
}

.notification-copy em {
  color: var(--text-muted);
  font-size: 0.68rem;
  font-style: normal;
}

.mark-read {
  margin-right: 0.75rem;
}

.notification-empty {
  padding: 1rem;
  text-align: center;
}

@media (max-width: 520px) {
  .notification-popover {
    position: fixed;
    top: 58px;
    right: 10px;
    left: 10px;
    width: auto;
  }
}
</style>
