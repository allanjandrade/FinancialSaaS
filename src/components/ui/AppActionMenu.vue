<template>
  <div class="app-action-menu" data-testid="app-action-menu">
    <AppIconButton :label="menuLabel" aria-haspopup="menu" :aria-expanded="open" @click="toggle" @keydown.esc="close">
      <MoreHorizontal :size="18" />
    </AppIconButton>
    <div v-if="open" class="app-action-menu__panel" role="menu" @keydown.esc="close">
      <button
        v-for="item in items"
        :key="item.id"
        type="button"
        role="menuitem"
        class="app-action-menu__item"
        :class="{ 'app-action-menu__item--danger': item.destructive }"
        @click="select(item)"
      >
        {{ item.label }}
      </button>
    </div>
  </div>
</template>

<script setup>
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { MoreHorizontal } from 'lucide-vue-next'
import AppIconButton from '@/components/ui/AppIconButton.vue'

defineProps({
  items: { type: Array, default: () => [] },
  menuLabel: { type: String, default: 'Abrir menu de ações' },
})

const emit = defineEmits(['select'])

const open = ref(false)

function toggle() {
  open.value = !open.value
}

function close() {
  open.value = false
}

function select(item) {
  emit('select', item)
  close()
}

function onDocumentClick(event) {
  if (!event.target.closest('.app-action-menu')) close()
}

onMounted(() => document.addEventListener('click', onDocumentClick))
onBeforeUnmount(() => document.removeEventListener('click', onDocumentClick))
</script>

<style scoped>
.app-action-menu {
  position: relative;
}

.app-action-menu__panel {
  position: absolute;
  top: calc(100% + 0.35rem);
  right: 0;
  z-index: 20;
  min-width: 180px;
  padding: 0.35rem;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  background: var(--bg-card);
  box-shadow: var(--shadow-card-hover);
}

.app-action-menu__item {
  width: 100%;
  min-height: var(--touch-target-min);
  padding: 0.55rem 0.75rem;
  border: none;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--text-primary);
  text-align: left;
  font-size: var(--text-sm);
  font-weight: 600;
  cursor: pointer;
}

.app-action-menu__item:hover {
  background: var(--bg-hover);
}

.app-action-menu__item--danger {
  color: var(--danger);
}
</style>
