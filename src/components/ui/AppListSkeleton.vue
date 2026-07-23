<template>
  <div class="app-list-skeleton" data-testid="app-list-skeleton">
    <div v-for="row in rows" :key="row" class="app-list-skeleton__row">
      <AppSkeleton height="40px" width="40px" radius="12px" />
      <div class="app-list-skeleton__copy">
        <AppSkeleton height="14px" width="46%" />
        <AppSkeleton height="12px" width="72%" />
      </div>
      <AppSkeleton height="32px" width="32px" radius="8px" />
    </div>
  </div>
</template>

<script setup>
import AppSkeleton from '@/components/ui/AppSkeleton.vue'

defineProps({
  rows: { type: Number, default: 4 },
})
</script>

<style scoped>
.app-list-skeleton {
  display: grid;
  gap: 0.75rem;
}

.app-list-skeleton__row {
  display: grid;
  grid-template-columns: 40px 1fr 32px;
  gap: 0.75rem;
  align-items: center;
}

.app-list-skeleton__copy {
  display: grid;
  gap: 0.4rem;
}
</style>
