<template>
  <div class="app-table-skeleton" data-testid="app-table-skeleton">
    <div class="app-table-skeleton__head">
      <AppSkeleton v-for="col in columns" :key="`head-${col}`" height="12px" />
    </div>
    <div v-for="row in rows" :key="row" class="app-table-skeleton__row">
      <AppSkeleton v-for="col in columns" :key="`${row}-${col}`" height="14px" />
    </div>
  </div>
</template>

<script setup>
import AppSkeleton from '@/components/ui/AppSkeleton.vue'

defineProps({
  rows: { type: Number, default: 5 },
  columns: { type: Number, default: 5 },
})
</script>

<style scoped>
.app-table-skeleton {
  display: grid;
  gap: 0.65rem;
}

.app-table-skeleton__head,
.app-table-skeleton__row {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 0.75rem;
  align-items: center;
}
</style>
