<template>
  <router-link :to="to" class="finance-manage-link">
    <Settings2 :size="16" />
    <span>{{ label }}</span>
    <ChevronRight :size="16" />
  </router-link>
</template>

<script setup>
import { computed } from 'vue'
import { Settings2, ChevronRight } from 'lucide-vue-next'

const props = defineProps({
  tab: {
    type: String,
    default: 'accounts',
    validator: (v) => ['accounts', 'cards', 'benefits', 'family', 'transfers'].includes(v),
  },
  label: {
    type: String,
    default: 'Gerenciar cadastro em Finanças',
  },
})

const to = computed(() => ({ path: '/structure', query: { tab: props.tab } }))
</script>

<style scoped>
.finance-manage-link {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.5rem 0.85rem;
  margin-bottom: 1.25rem;
  border-radius: var(--radius-md);
  border: 1px solid var(--border-color);
  background: rgba(59, 130, 246, 0.08);
  color: var(--accent);
  font-size: 0.8125rem;
  font-weight: 500;
  text-decoration: none;
  transition: background 0.2s ease;
}

.finance-manage-link:hover {
  background: rgba(59, 130, 246, 0.14);
}
</style>
