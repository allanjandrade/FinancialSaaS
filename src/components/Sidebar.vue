<template>
  <aside class="app-sidebar" :class="{ expanded }" data-testid="app-sidebar" aria-label="Navegação principal">
    <router-link class="sidebar-logo" to="/dashboard" aria-label="Dashboard" title="Dashboard">
      <AppLogo :variant="expanded ? 'full' : 'icon'" />
    </router-link>

    <nav class="sidebar-nav" aria-label="Menu principal">
      <section
        v-for="group in visibleNavGroups"
        :key="group.id"
        class="nav-section"
        :class="{ active: isGroupActive(group) }"
        :aria-label="group.label"
      >
        <p v-if="expanded" class="nav-group-label">{{ group.label }}</p>
        <router-link
          v-for="item in group.items"
          :key="item.path"
          class="nav-item"
          :class="{ active: isActive(item), locked: isLocked(item) }"
          :to="itemTarget(item)"
          :title="itemTitle(item)"
          :aria-label="itemTitle(item)"
          :aria-current="isActive(item) ? 'page' : undefined"
          @mouseenter="updateTooltipPosition"
          @focus="updateTooltipPosition"
          @mouseleave="hideTooltip"
          @blur="hideTooltip"
        >
          <component :is="iconFor(item.icon)" aria-hidden="true" />
          <span class="nav-label">{{ item.label }}</span>
          <span v-if="isLocked(item)" class="premium-chip">
            <Lock aria-hidden="true" />
            <span>Premium</span>
          </span>
        </router-link>
      </section>
    </nav>

    <footer class="sidebar-footer">
      <router-link class="sidebar-user" to="/settings" :title="profileName" :aria-label="`Perfil de ${profileName}`">
        <UserAvatar :src="profileStore.avatarUrl" :name="profileName" :email="authStore.user?.email || ''" size="sm" />
        <span v-if="expanded">{{ profileName }}</span>
      </router-link>
      <button
        class="nav-toggle"
        type="button"
        :aria-label="expanded ? 'Recolher menu' : 'Expandir menu'"
        :title="expanded ? 'Recolher menu' : 'Expandir menu'"
        @mouseenter="updateTooltipPosition"
        @focus="updateTooltipPosition"
        @mouseleave="hideTooltip"
        @blur="hideTooltip"
        @click="toggleExpanded"
      >
        <PanelLeftClose v-if="expanded" aria-hidden="true" />
        <PanelLeftOpen v-else aria-hidden="true" />
        <span v-if="expanded">{{ expanded ? 'Recolher menu' : 'Expandir menu' }}</span>
      </button>
    </footer>
  </aside>

  <Teleport to="body">
    <span v-if="tooltipLabel" class="nav-tooltip" :style="tooltipStyle" role="tooltip">{{ tooltipLabel }}</span>
  </Teleport>

  <nav class="mobile-bottom-nav" aria-label="Navegação mobile" data-testid="mobile-bottom-nav">
    <router-link
      v-for="item in mobilePrimaryItems"
      :key="item.label"
      :to="item.path"
      :class="{ active: item.active() }"
      :aria-current="item.active() ? 'page' : undefined"
    >
      <component :is="item.icon" aria-hidden="true" />
      <span>{{ item.label }}</span>
    </router-link>
    <button
      type="button"
      :class="{ active: mobileOpen }"
      aria-label="Abrir menu Mais"
      data-testid="mobile-more-button"
      @pointerdown.prevent="openDrawer"
      @mousedown.prevent="openDrawer"
      @focus="openDrawer"
      @click.stop="openDrawer"
    >
      <Menu aria-hidden="true" />
      <span>Mais</span>
    </button>
  </nav>

  <button
    v-if="drawerOpen || mobileOpen"
    class="mobile-drawer-backdrop"
    type="button"
    aria-label="Fechar menu"
    @click="closeDrawer"
  />
  <aside
    class="mobile-drawer"
    :class="{ open: isDrawerVisible }"
    :data-open="isDrawerVisible ? 'true' : 'false'"
    data-testid="mobile-more-drawer"
    aria-label="Mais navegação"
  >
    <header>
      <strong>Mais opções</strong>
      <button type="button" aria-label="Fechar menu" @click="closeDrawer">
        <X aria-hidden="true" />
      </button>
    </header>
    <section v-for="group in visibleNavGroups" :key="`mobile-${group.id}`" class="mobile-group">
      <p>{{ group.label }}</p>
      <router-link
        v-for="item in group.items"
        :key="item.path"
        :to="itemTarget(item)"
        :class="{ active: isActive(item), locked: isLocked(item) }"
        :aria-current="isActive(item) ? 'page' : undefined"
        @click="closeDrawer"
      >
        <component :is="iconFor(item.icon)" aria-hidden="true" />
        <span>{{ item.label }}</span>
        <span v-if="isLocked(item)" class="premium-chip mobile">
          <Lock aria-hidden="true" />
          <span>Premium</span>
        </span>
      </router-link>
    </section>
  </aside>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import {
  Activity,
  BarChart3,
  BellRing,
  Bot,
  BrainCircuit,
  CreditCard,
  FileText,
  Gauge,
  Home,
  LifeBuoy,
  LineChart,
  Lock,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  PiggyBank,
  Receipt,
  Settings,
  ShieldCheck,
  ShoppingBag,
  Target,
  Users,
  WalletCards,
  X,
  Zap,
} from 'lucide-vue-next'
import { NAV_GROUPS, groupForPath, isItemActive } from '@/router/navigation.js'
import { canSeeNavItem } from '@/domain/access-control.js'
import { isNavItemLocked } from '@/domain/entitlements/featureAccess.js'
import AppLogo from '@/components/brand/AppLogo.vue'
import UserAvatar from '@/components/profile/UserAvatar.vue'
import { useAuthStore } from '@/stores/auth'
import { useProfileStore } from '@/stores/profileStore.js'
import { loadAuthenticatedContext, useAuthenticatedContext } from '@/lib/authenticated-context.js'

const props = defineProps({
  mobileOpen: {
    type: Boolean,
    default: false,
  },
})

const emit = defineEmits(['close', 'expanded-change', 'open'])
const route = useRoute()
const authStore = useAuthStore()
const profileStore = useProfileStore()
const expanded = ref(false)
const drawerOpen = ref(false)
const tooltipTop = ref(96)
const tooltipLabel = ref('')
const navGroups = NAV_GROUPS
const { access: currentAccess } = useAuthenticatedContext()

const tooltipStyle = computed(() => ({ top: `${tooltipTop.value}px` }))
const isDrawerVisible = computed(() => drawerOpen.value || props.mobileOpen)
const profileName = computed(() => profileStore.displayName || authStore.user?.user_metadata?.name || authStore.user?.email?.split('@')[0] || 'Usuário')
const icons = {
  dashboard: BarChart3,
  commandCenter: Gauge,
  reports: BarChart3,
  entries: Receipt,
  accounts: CreditCard,
  benefits: WalletCards,
  plan: LineChart,
  goals: Target,
  budget: PiggyBank,
  subscriptions: Receipt,
  purchases: ShoppingBag,
  simulator: BellRing,
  copilot: BrainCircuit,
  advisor: BrainCircuit,
  aiActions: Bot,
  automations: Zap,
  settings: Settings,
  billing: CreditCard,
  family: Users,
  support: LifeBuoy,
  admin: ShieldCheck,
  operational: Activity,
  security: ShieldCheck,
  integrations: Zap,
}

const visibleNavGroups = computed(() => navGroups.map((group) => ({
  ...group,
  items: group.items.filter((item) => canSeeNavItem(item, currentAccess.value)),
})).filter((group) => group.items.length))

const mobilePrimaryItems = computed(() => [
  { label: 'Início', path: '/dashboard', icon: Home, active: () => ['Início'].includes(groupForPath(route.fullPath)) },
  { label: 'Lançamentos', path: '/entries', icon: Receipt, active: () => isItemActive(route.fullPath, '/entries') },
  { label: 'Planejamento', path: '/plan', icon: LineChart, active: () => isItemActive(route.fullPath, '/plan') || isItemActive(route.fullPath, '/purchases') },
])

onMounted(async () => {
  expanded.value = localStorage.getItem('sidebar-expanded') === 'true'
  await loadAuthenticatedContext().catch(() => {})
  emit('expanded-change', expanded.value)
})

watch(expanded, (value) => {
  localStorage.setItem('sidebar-expanded', String(value))
  emit('expanded-change', value)
})

watch(
  () => props.mobileOpen,
  (open) => { if (open) drawerOpen.value = true },
)

watch(
  () => route.fullPath,
  () => closeDrawer(),
)

function iconFor(name) {
  return icons[name] || FileText
}

function isActive(item) {
  return isItemActive(route.fullPath, item.path)
}

function isLocked(item) {
  return isNavItemLocked(item, currentAccess.value)
}

function itemTarget(item) {
  if (!isLocked(item)) return item.path
  return {
    path: '/billing',
    query: {
      locked: '1',
      feature: item.premiumFeature,
      from: item.path,
    },
  }
}

function itemTitle(item) {
  return isLocked(item) ? `${item.label} Premium` : item.label
}

function isGroupActive(group) {
  return group.items.some(isActive)
}

function toggleExpanded() {
  expanded.value = !expanded.value
}

function updateTooltipPosition(event) {
  if (expanded.value) return
  const rect = event.currentTarget.getBoundingClientRect()
  tooltipTop.value = Math.round(rect.top + rect.height / 2)
  tooltipLabel.value = event.currentTarget.getAttribute('aria-label') || event.currentTarget.getAttribute('title') || ''
}

function hideTooltip() {
  tooltipLabel.value = ''
}

function openDrawer() {
  drawerOpen.value = true
  emit('open')
}

function closeDrawer() {
  drawerOpen.value = false
  emit('close')
}
</script>

<style scoped>
.app-sidebar {
  position: sticky;
  top: 0;
  z-index: 10000;
  width: 76px;
  min-width: 76px;
  max-width: 76px;
  height: 100vh;
  padding: 1rem 0.7rem;
  display: grid;
  grid-template-rows: auto 1fr auto;
  gap: 1rem;
  overflow-x: hidden;
  background:
    linear-gradient(180deg, color-mix(in srgb, var(--bg-sidebar) 92%, var(--bg-hover)), var(--bg-sidebar));
  border-right: 1px solid color-mix(in srgb, var(--border-color) 78%, transparent);
  box-shadow: 1px 0 0 rgba(15, 23, 42, 0.02);
  transition: width 0.18s ease, max-width 0.18s ease, min-width 0.18s ease;
}

.app-sidebar.expanded {
  width: 272px;
  min-width: 272px;
  max-width: 272px;
}

.sidebar-logo {
  min-width: 0;
  width: 100%;
  min-height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  text-decoration: none;
  border-radius: var(--radius-md);
}

.app-sidebar.expanded .sidebar-logo {
  justify-content: start;
}

.sidebar-nav {
  min-width: 0;
  overflow-x: hidden;
  overflow-y: auto;
  display: grid;
  align-content: start;
  gap: 0.7rem;
  scrollbar-width: thin;
}

.sidebar-footer {
  min-width: 0;
  display: grid;
  gap: 0.55rem;
}

.sidebar-user {
  min-width: 0;
  min-height: 42px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.65rem;
  overflow: hidden;
  color: var(--text-secondary);
  text-decoration: none;
  font-weight: 850;
}

.app-sidebar.expanded .sidebar-user {
  justify-content: start;
  padding: 0 0.45rem;
}

.sidebar-user span {
  min-width: 0;
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.nav-section {
  display: grid;
  gap: 0.22rem;
}

.nav-group-label {
  margin: 0.4rem 0 0.25rem;
  padding: 0 0.65rem;
  color: var(--text-muted);
  font-family: var(--font-sans);
  font-size: 0.64rem;
  font-weight: 700;
  letter-spacing: var(--eyebrow-letter-spacing);
  text-transform: uppercase;
}

.nav-section.active .nav-group-label {
  color: var(--accent-hover);
}

.nav-item,
.nav-toggle {
  position: relative;
  width: 100%;
  min-height: 44px;
  display: flex;
  align-items: center;
  gap: 0.75rem;
  border: 1px solid transparent;
  border-radius: var(--radius-md);
  background: transparent;
  color: var(--text-secondary);
  text-decoration: none;
  cursor: pointer;
  font: inherit;
  font-size: 0.8rem;
  font-weight: 760;
  min-width: 0;
  overflow: hidden;
}

.nav-item {
  justify-content: center;
  padding: 0;
}

.app-sidebar.expanded .nav-item,
.app-sidebar.expanded .nav-toggle {
  justify-content: start;
  padding: 0 0.7rem;
}

.nav-item svg,
.nav-toggle svg {
  width: 19px;
  height: 19px;
  flex: 0 0 auto;
}

.nav-label,
.nav-toggle > span:not(.nav-tooltip) {
  min-width: 0;
  display: none;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.app-sidebar.expanded .nav-label,
.app-sidebar.expanded .nav-toggle > span:not(.nav-tooltip) {
  display: inline;
}

.app-sidebar.expanded .nav-tooltip {
  display: none;
}

.nav-item:hover,
.nav-item:focus-visible,
.nav-toggle:hover,
.nav-toggle:focus-visible {
  color: var(--text-primary);
  background: color-mix(in srgb, var(--bg-hover) 72%, var(--bg-panel));
  outline: 2px solid transparent;
  border-color: var(--border-color);
}

.nav-item.active {
  color: var(--accent-hover);
  background: linear-gradient(135deg, var(--blue-dim), color-mix(in srgb, var(--accent-cyan) 9%, transparent));
  border-color: color-mix(in srgb, var(--accent) 30%, var(--border-color));
  font-weight: 900;
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--accent) 8%, transparent);
}

.nav-item.locked {
  color: color-mix(in srgb, var(--text-muted) 82%, var(--warning));
}

.premium-chip {
  display: none;
  align-items: center;
  gap: 0.25rem;
  max-width: 76px;
  margin-left: auto;
  padding: 0.12rem 0.38rem;
  border: 1px solid rgba(240, 180, 93, 0.32);
  border-radius: 999px;
  color: var(--warning);
  font-size: 0.64rem;
  font-weight: 900;
  overflow: hidden;
}

.premium-chip span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.premium-chip svg {
  width: 12px;
  height: 12px;
}

.app-sidebar.expanded .premium-chip {
  display: inline-flex;
}

.nav-item.active::before {
  content: '';
  position: absolute;
  left: -0.7rem;
  width: 3px;
  height: 24px;
  border-radius: 0 999px 999px 0;
  background: var(--gradient-accent);
}

.nav-toggle {
  justify-content: center;
  color: var(--text-secondary);
  border-color: var(--border-color);
  background: color-mix(in srgb, var(--bg-panel) 70%, var(--bg-hover));
}

.nav-tooltip {
  position: fixed !important;
  left: 88px;
  z-index: 2147483647 !important;
  min-width: max-content;
  max-width: 220px;
  padding: 0.45rem 0.6rem;
  border: 1px solid var(--border-strong);
  border-radius: var(--radius-md);
  background: var(--bg-glass);
  color: var(--text-primary);
  box-shadow: var(--shadow-floating);
  opacity: 1;
  visibility: visible;
  transform: translateY(-50%) translateX(0);
  pointer-events: none;
  transition: 0.14s ease;
}

.mobile-bottom-nav,
.mobile-drawer,
.mobile-drawer-backdrop {
  display: none;
}

@media (max-width: 768px) {
  .app-sidebar {
    display: none;
  }

  .mobile-bottom-nav {
    position: fixed;
    left: 0;
    right: 0;
    bottom: 0;
    z-index: 85;
    min-height: 64px;
    padding: 0.35rem 0.55rem calc(0.35rem + env(safe-area-inset-bottom));
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 0.35rem;
    border-top: 1px solid var(--border-color);
    background: var(--bg-panel);
    box-shadow: var(--shadow-card);
  }

  .mobile-bottom-nav a,
  .mobile-bottom-nav button {
    min-width: 0;
    min-height: 48px;
    display: grid;
    place-items: center;
    gap: 0.18rem;
    border: 0;
    border-radius: var(--radius-sm);
    background: transparent;
    color: var(--text-muted);
    text-decoration: none;
    font-size: 0.66rem;
    font-weight: 800;
  }

  .mobile-bottom-nav svg {
    width: 18px;
    height: 18px;
  }

  .mobile-bottom-nav .active,
  .mobile-bottom-nav a.router-link-active {
    color: var(--accent);
    background: var(--blue-dim);
  }

  .mobile-drawer-backdrop {
    position: fixed;
    inset: 0;
    z-index: 88;
    display: block;
    border: 0;
    background: rgba(0, 0, 0, 0.58);
  }

  .mobile-drawer {
    position: fixed;
    left: 0;
    right: 0;
    bottom: 0;
    z-index: 90;
    max-height: min(80vh, 680px);
    padding: 1rem 1rem calc(1rem + env(safe-area-inset-bottom));
    display: grid;
    gap: 0.85rem;
    overflow-y: auto;
    border-radius: 12px 12px 0 0;
    border: 1px solid var(--border-strong);
    background: var(--bg-panel);
    box-shadow: var(--shadow-card-hover);
    transform: translateY(105%);
    transition: transform 0.2s ease;
  }

  .mobile-drawer.open {
    transform: translateY(0);
  }

  .mobile-drawer header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
  }

  .mobile-drawer header strong {
    color: var(--text-primary);
  }

  .mobile-drawer header button {
    width: 38px;
    height: 38px;
    display: grid;
    place-items: center;
    border: 1px solid var(--border-color);
    border-radius: var(--radius-sm);
    background: var(--bg-elevated);
    color: var(--text-secondary);
  }

  .mobile-group {
    display: grid;
    gap: 0.35rem;
  }

  .mobile-group p {
    margin: 0.55rem 0 0.1rem;
    color: var(--accent-hover);
    font-size: 0.7rem;
    font-weight: 900;
    text-transform: uppercase;
  }

  .mobile-group a {
    min-height: 44px;
    display: flex;
    align-items: center;
    gap: 0.7rem;
    padding: 0 0.75rem;
    border-radius: var(--radius-sm);
    color: var(--text-secondary);
    text-decoration: none;
    font-weight: 800;
  }

  .mobile-group a.active {
    color: var(--accent);
    background: var(--blue-dim);
  }

  .mobile-group a.locked {
    color: color-mix(in srgb, var(--text-secondary) 80%, var(--warning));
  }

  .premium-chip.mobile {
    display: inline-flex;
  }

  .mobile-group svg {
    width: 18px;
  }
}
</style>
