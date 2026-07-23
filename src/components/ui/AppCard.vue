<template>
  <section class="app-card" :class="{ 'app-card--loading': loading }" data-testid="app-card">
    <header v-if="title || $slots.header || $slots.actions" class="app-card__header">
      <div>
        <slot name="header">
          <h2 v-if="title" class="app-card__title">{{ title }}</h2>
          <p v-if="subtitle" class="app-card__subtitle">{{ subtitle }}</p>
        </slot>
      </div>
      <div v-if="$slots.actions" class="app-card__actions">
        <slot name="actions" />
      </div>
    </header>

    <div v-if="loading" class="app-card__skeleton" aria-hidden="true">
      <AppSkeleton height="18px" width="42%" />
      <AppSkeleton height="14px" width="68%" />
      <AppSkeleton height="14px" width="88%" />
      <AppSkeleton height="14px" width="72%" />
    </div>

    <div v-else class="app-card__body">
      <slot />
    </div>
  </section>
</template>

<script setup>
import AppSkeleton from '@/components/ui/AppSkeleton.vue'

defineProps({
  title: { type: String, default: '' },
  subtitle: { type: String, default: '' },
  loading: { type: Boolean, default: false },
})
</script>

<style scoped>
.app-card__actions {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.app-card__skeleton {
  display: grid;
  gap: 0.65rem;
}

.app-card--loading .app-card__body {
  display: none;
}
</style>
