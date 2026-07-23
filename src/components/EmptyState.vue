<template>
  <AppEmptyState
    :icon="icon"
    :title="title"
    :description="description"
    :action-label="actionLabel"
    :action-to="actionTo"
    :secondary-label="secondaryLabel"
    :secondary-to="secondaryTo"
    :compact="compact"
    :loading="loading"
    @action="$emit('action')"
    @secondary="$emit('secondary')"
  />
</template>

<script setup>
import AppEmptyState from '@/components/ui/AppEmptyState.vue'

defineProps({
  icon: { type: [Object, Function], default: null },
  title: { type: String, required: true },
  description: { type: String, required: true },
  actionLabel: { type: String, default: '' },
  actionTo: { type: [String, Object], default: '' },
  secondaryLabel: { type: String, default: '' },
  secondaryTo: { type: [String, Object], default: '' },
  compact: { type: Boolean, default: false },
  loading: { type: Boolean, default: false },
})

defineEmits(['action', 'secondary'])
</script>
