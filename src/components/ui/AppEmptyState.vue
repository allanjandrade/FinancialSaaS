<template>
  <div v-if="!loading" class="app-empty-state" :class="{ 'app-empty-state--compact': compact }" role="status" data-testid="app-empty-state">
    <div class="app-empty-state__icon" aria-hidden="true">
      <component :is="icon || Inbox" :size="compact ? 24 : 28" />
    </div>
    <div class="app-empty-state__copy">
      <h3>{{ title }}</h3>
      <p>{{ description }}</p>
    </div>
    <div v-if="actionLabel || secondaryLabel" class="app-empty-state__actions">
      <AppButton v-if="actionLabel && actionTo" :to="actionTo">{{ actionLabel }}</AppButton>
      <AppButton v-else-if="actionLabel" @click="$emit('action')">{{ actionLabel }}</AppButton>
      <AppButton v-if="secondaryLabel && secondaryTo" variant="secondary" :to="secondaryTo">{{ secondaryLabel }}</AppButton>
      <AppButton v-else-if="secondaryLabel" variant="secondary" @click="$emit('secondary')">{{ secondaryLabel }}</AppButton>
    </div>
  </div>
  <div v-else class="app-empty-state__loading" data-testid="app-empty-state-loading">
    <AppListSkeleton :rows="2" />
  </div>
</template>

<script setup>
import { Inbox } from 'lucide-vue-next'
import AppButton from '@/components/ui/AppButton.vue'
import AppListSkeleton from '@/components/ui/AppListSkeleton.vue'

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

<style scoped>
.app-empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.85rem;
  padding: 2rem;
  border: 1px dashed var(--border-color);
  border-radius: var(--radius-lg);
  background: color-mix(in srgb, var(--bg-hover) 55%, transparent);
  text-align: center;
}

.app-empty-state--compact {
  padding: 1.15rem;
}

.app-empty-state__icon {
  width: 52px;
  height: 52px;
  display: grid;
  place-items: center;
  border-radius: 16px;
  color: var(--accent-purple);
  background: color-mix(in srgb, var(--accent-purple) 14%, transparent);
}

.app-empty-state--compact .app-empty-state__icon {
  width: 42px;
  height: 42px;
  border-radius: var(--radius-md);
}

.app-empty-state__copy h3,
.app-empty-state__copy p {
  margin: 0;
}

.app-empty-state__copy h3 {
  font-size: 1rem;
  color: var(--text-primary);
}

.app-empty-state__copy p {
  max-width: 460px;
  margin-top: 0.35rem;
  color: var(--text-secondary);
  font-size: 0.875rem;
  line-height: 1.5;
}

.app-empty-state__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.6rem;
  justify-content: center;
}
</style>
