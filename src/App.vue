<template>
  <div id="app" class="app-shell">
    <Sidebar
      v-if="!isPublicShell"
      :mobile-open="mobileMenuOpen"
      @expanded-change="sidebarExpanded = $event"
      @open="mobileMenuOpen = true"
      @close="mobileMenuOpen = false"
    />
    <main class="main" :class="{ 'full-width': isPublicShell }">
      <Topbar v-if="!isPublicShell" @toggle-mobile-menu="mobileMenuOpen = !mobileMenuOpen" />
      <Breadcrumb v-if="!isPublicShell" :items="breadcrumbItems" />
      <div class="main-content">
        <router-view v-slot="{ Component }">
          <transition name="fade" mode="out-in">
            <div class="route-view" :key="route.path">
              <component v-if="Component" :is="Component" />
            </div>
          </transition>
        </router-view>
      </div>
    </main>
    <AppToast />
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import Sidebar from './components/Sidebar.vue'
import Topbar from './components/Topbar.vue'
import Breadcrumb from '@/components/layout/Breadcrumb.vue'
import AppToast from '@/components/ui/AppToast.vue'
import { useTheme } from '@/composables/useTheme'
import { useNotification } from '@/composables/useNotification'
import { useAuthStore } from '@/stores/auth'
import { useFamilySyncStore } from '@/stores/family-sync'
import { useProfileStore } from '@/stores/profileStore.js'
import { ensureActivePriceMonitoring } from '@/utils/active-price-monitor.js'
import { metaForPath } from '@/router/navigation.js'
import { getSupabaseClient } from '@/lib/supabase-client.js'
import { loadAuthenticatedContext } from '@/lib/authenticated-context.js'

const route = useRoute()
const authStore = useAuthStore()
const familySync = useFamilySyncStore()
const profileStore = useProfileStore()
const isPublicShell = computed(() => route.meta.publicPage || ['/login', '/signup', '/privacy', '/terms', '/cookies', '/pricing', '/'].includes(route.path))
const mobileMenuOpen = ref(false)
const sidebarExpanded = ref(false)
const breadcrumbItems = computed(() => route.meta.breadcrumb || metaForPath(route.path).breadcrumb || [])
const { initTheme } = useTheme()
const { showToast } = useNotification()
let appContextPromise = null

function onRemoteFinanceUpdate(event) {
  const priceAlert = event.detail?.priceAlert
  showToast(priceAlert?.message || 'Dados atualizados por outro dispositivo', priceAlert ? 'success' : 'info')
}

function configurePriceMonitoring() {
  ensureActivePriceMonitoring().catch((error) => {
    console.warn('ACTIVE_PRICE_MONITOR_SETUP_ERROR', error)
  })
}

async function loadAppAuthenticatedContext() {
  if (!authStore.isAuthenticated || isPublicShell.value) return null
  if (appContextPromise) return appContextPromise

  appContextPromise = (async () => {
    const context = await loadAuthenticatedContext()
    if (context?.warning) showToast(context.warning, 'warning')

    await profileStore.loadProfile(getSupabaseClient(), authStore.user).catch(() => {})
    const result = await familySync.bootstrap()
    if (result?.joined) configurePriceMonitoring()
    return result
  })().finally(() => {
    appContextPromise = null
  })

  return appContextPromise
}

onMounted(async () => {
  initTheme()
  window.addEventListener('finance-remote-update', onRemoteFinanceUpdate)
  await loadAppAuthenticatedContext()
})

onBeforeUnmount(() => {
  window.removeEventListener('finance-remote-update', onRemoteFinanceUpdate)
})

watch(
  () => route.fullPath,
  () => {
    mobileMenuOpen.value = false
    loadAppAuthenticatedContext()
  },
)

watch(
  () => authStore.isAuthenticated,
  async (loggedIn) => {
    if (loggedIn) {
      await loadAppAuthenticatedContext()
    } else {
      profileStore.reset()
      familySync.teardown()
    }
  },
)
</script>

<style scoped>
.app-shell {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  min-height: 100vh;
  background: var(--bg-shell);
}

.main {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
  background: var(--bg-shell);
}

.main-content {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  background: var(--bg-shell);
}

.route-view {
  min-width: 0;
}

.main.full-width {
  grid-column: 1 / -1;
  background: var(--bg-shell);
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.25s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

@media (max-width: 768px) {
  .app-shell {
    display: block;
  }

  .main-content {
    padding-bottom: 76px;
  }
}
</style>
