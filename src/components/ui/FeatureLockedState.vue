<template>
  <AppEmptyState
    :icon="Lock"
    :title="title"
    :description="description"
    :action-label="actionLabel"
    :action-to="actionTo"
    compact
    data-testid="feature-locked-state"
    @action="$emit('action')"
  />
</template>

<script setup>
import { Lock } from 'lucide-vue-next'
import AppEmptyState from '@/components/ui/AppEmptyState.vue'

defineProps({
  title: { type: String, default: 'Recurso Premium' },
  description: { type: String, default: 'Este recurso faz parte do plano Premium.' },
  actionLabel: { type: String, default: 'Ver planos' },
  actionTo: { type: [String, Object], default: '/pricing' },
})

defineEmits(['action'])
</script>
