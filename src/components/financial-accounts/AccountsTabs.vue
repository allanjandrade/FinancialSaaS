<template>
  <nav
    class="accounts-tab-orbit"
    data-testid="accounts-premium-tabs"
    role="tablist"
    aria-label="Navegação de cadastro financeiro"
  >
    <button
      v-for="tab in primaryTabs"
      :key="tab.id"
      type="button"
      role="tab"
      class="accounts-tab touch-target"
      :class="{ active: props.activeTab === tab.id }"
      :aria-selected="props.activeTab === tab.id"
      @click="emit('update:activeTab', tab.id)"
    >
      <span class="tab-label">{{ tab.label }}</span>
      <span v-if="countFor(tab.id) !== null" class="tab-count">{{ countFor(tab.id) }}</span>
    </button>

    <div
      v-if="secondaryTabs.length"
      class="accounts-tab-more"
      :class="{ 'is-open': moreMenuOpen }"
      @keydown.esc="closeMoreMenu"
      @focusout="handleMoreFocusout"
    >
      <button
        type="button"
        role="tab"
        class="accounts-tab more-trigger touch-target"
        :class="{ active: isSecondaryActive }"
        :aria-selected="isSecondaryActive"
        aria-haspopup="menu"
        :aria-expanded="moreMenuOpen"
        @click="toggleMoreMenu"
      >
        <span class="tab-label">Mais</span>
        <span v-if="isSecondaryActive" class="more-current">{{ secondaryActiveLabel }}</span>
      </button>
      <div v-if="moreMenuOpen" class="accounts-tab-menu" role="menu" aria-label="Mais seções de contas">
        <button
          v-for="tab in secondaryTabs"
          :key="tab.id"
          type="button"
          role="menuitemradio"
          class="accounts-tab menu-item"
          :class="{ active: props.activeTab === tab.id }"
          :aria-checked="props.activeTab === tab.id"
          @click="selectSecondaryTab(tab.id)"
        >
          <span class="tab-label">{{ tab.label }}</span>
          <span v-if="countFor(tab.id) !== null" class="tab-count">{{ countFor(tab.id) }}</span>
        </button>
      </div>
    </div>
  </nav>
</template>

<script setup>
import { computed, ref } from 'vue'

const PRIMARY_TAB_IDS = ['accounts', 'cards', 'benefits', 'family', 'transfers']

const props = defineProps({
  tabs: { type: Array, default: () => [] },
  activeTab: { type: String, default: '' },
  counts: { type: Object, default: () => ({}) },
})

const emit = defineEmits(['update:activeTab'])
const moreMenuOpen = ref(false)

const primaryTabs = computed(() => props.tabs.filter((tab) => PRIMARY_TAB_IDS.includes(tab.id)))
const secondaryTabs = computed(() => props.tabs.filter((tab) => !PRIMARY_TAB_IDS.includes(tab.id)))
const isSecondaryActive = computed(() => secondaryTabs.value.some((tab) => tab.id === props.activeTab))
const secondaryActiveLabel = computed(() =>
  secondaryTabs.value.find((tab) => tab.id === props.activeTab)?.label || secondaryTabs.value.length,
)

function countFor(id) {
  if (!(id in props.counts)) return null
  const count = Number(props.counts[id] || 0)
  return Number.isFinite(count) ? count : 0
}

function toggleMoreMenu() {
  moreMenuOpen.value = !moreMenuOpen.value
}

function closeMoreMenu() {
  moreMenuOpen.value = false
}

function selectSecondaryTab(id) {
  emit('update:activeTab', id)
  closeMoreMenu()
}

function handleMoreFocusout(event) {
  if (!event.currentTarget.contains(event.relatedTarget)) {
    closeMoreMenu()
  }
}
</script>

<style scoped>
.accounts-tab-orbit {
  position: relative;
  display: flex;
  align-items: stretch;
  flex-wrap: wrap;
  gap: 0.45rem;
  max-width: 100%;
  padding: 0.45rem;
  overflow: visible;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-lg);
  background: color-mix(in srgb, var(--bg-panel) 86%, var(--bg-hover));
  font-family: var(--font-sans);
  box-shadow: var(--shadow-card);
  scrollbar-width: thin;
}

.accounts-tab {
  position: relative;
  flex: 0 0 auto;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.45rem;
  min-height: 42px;
  padding: 0.58rem 0.82rem;
  border: 1px solid transparent;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--text-secondary);
  cursor: pointer;
  font-size: var(--text-sm);
  font-weight: 800;
  white-space: nowrap;
  transition: background 0.15s ease, border-color 0.15s ease, color 0.15s ease;
}

.accounts-tab::after {
  content: '';
  position: absolute;
  left: 0.65rem;
  right: 0.65rem;
  bottom: 0.28rem;
  height: 2px;
  border-radius: 999px;
  background: transparent;
}

.accounts-tab:hover,
.accounts-tab.active {
  border-color: color-mix(in srgb, var(--accent) 22%, var(--border-color));
  background: var(--bg-panel);
  color: var(--text-primary);
}

.accounts-tab.active::after {
  background: var(--accent-purple);
}

.tab-label {
  min-width: 0;
}

.tab-count {
  display: inline-grid;
  place-items: center;
  min-width: 1.35rem;
  height: 1.35rem;
  padding: 0 0.38rem;
  border-radius: var(--radius-pill);
  background: var(--blue-dim);
  color: var(--accent);
  font-size: 0.68rem;
  font-weight: 900;
  font-variant-numeric: tabular-nums;
}

.accounts-tab.active .tab-count {
  background: color-mix(in srgb, var(--accent) 16%, var(--bg-elevated));
  color: var(--text-primary);
}

.accounts-tab-more {
  position: relative;
  flex: 0 0 auto;
  z-index: 30;
}

.more-trigger {
  height: 100%;
}

.more-trigger .tab-label {
  display: inline-flex;
  align-items: center;
  gap: 0.42rem;
}

.more-trigger .tab-label::after {
  content: '';
  width: 0.42rem;
  height: 0.42rem;
  border-right: 2px solid currentColor;
  border-bottom: 2px solid currentColor;
  transform: rotate(45deg) translateY(-2px);
  transition: transform 0.15s ease;
}

.accounts-tab-more.is-open .more-trigger .tab-label::after {
  transform: rotate(225deg) translateY(-1px);
}

.more-current {
  max-width: 10rem;
  min-height: 1.35rem;
  display: inline-flex;
  align-items: center;
  padding: 0 0.48rem;
  overflow: hidden;
  border-radius: var(--radius-pill);
  background: var(--blue-dim);
  color: var(--accent);
  font-size: 0.68rem;
  font-weight: 900;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.accounts-tab-menu {
  position: absolute;
  right: 0;
  top: calc(100% + 0.62rem);
  z-index: 40;
  min-width: 240px;
  display: grid;
  gap: 0.35rem;
  padding: 0.5rem;
  border: 1px solid color-mix(in srgb, var(--accent) 18%, var(--border-color));
  border-radius: var(--radius-lg);
  background: color-mix(in srgb, var(--bg-panel) 94%, var(--bg-hover));
  box-shadow: var(--shadow-floating);
  backdrop-filter: blur(16px);
}

.accounts-tab-menu::before {
  content: '';
  position: absolute;
  top: -6px;
  right: 1.15rem;
  width: 10px;
  height: 10px;
  border-left: 1px solid color-mix(in srgb, var(--accent) 18%, var(--border-color));
  border-top: 1px solid color-mix(in srgb, var(--accent) 18%, var(--border-color));
  background: inherit;
  transform: rotate(45deg);
}

.accounts-tab-menu .accounts-tab {
  width: 100%;
  justify-content: space-between;
  min-height: 38px;
  padding: 0.55rem 0.7rem;
  border-radius: var(--radius-sm);
  background: transparent;
  text-align: left;
}

.accounts-tab-menu .accounts-tab::after {
  left: 0.45rem;
  right: auto;
  top: 50%;
  bottom: auto;
  width: 3px;
  height: 0;
  transform: translateY(-50%);
}

.accounts-tab-menu .accounts-tab:hover,
.accounts-tab-menu .accounts-tab.active {
  background: color-mix(in srgb, var(--accent) 9%, var(--bg-panel));
}

.accounts-tab-menu .accounts-tab.active::after {
  height: 1.15rem;
  background: var(--accent-purple);
}

@media (max-width: 720px) {
  .accounts-tab {
    flex: 1 1 calc(50% - 0.45rem);
  }

  .accounts-tab-more {
    flex: 1 1 100%;
  }

  .more-trigger {
    width: 100%;
  }

  .accounts-tab-menu {
    left: 0;
    right: 0;
    min-width: 0;
  }

  .accounts-tab-menu::before {
    right: 1.4rem;
  }
}
</style>
