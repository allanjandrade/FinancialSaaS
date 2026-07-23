<template>
  <div class="section-grid" :style="gridStyle">
    <slot />
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  columns: { type: Number, default: 1 },
  gap: { type: String, default: 'var(--section-gap)' },
})

const gridStyle = computed(() => ({
  display: 'grid',
  gap: props.gap,
  gridTemplateColumns: `repeat(${props.columns}, minmax(0, 1fr))`,
}))
</script>
