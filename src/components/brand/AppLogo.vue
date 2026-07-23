<template>
  <span class="app-logo" :class="[`variant-${variant}`]" :aria-label="ariaLabel">
    <BrandMark class="app-logo-mark" />
    <span v-if="variant === 'full'" class="app-logo-copy">
      <strong>Controle Financeiro</strong>
      <small>Operação financeira</small>
    </span>
  </span>
</template>

<script setup>
import { computed } from 'vue'
import BrandMark from '@/components/brand/BrandMark.vue'

const props = defineProps({
  variant: {
    type: String,
    default: 'full',
    validator: (value) => ['full', 'compact', 'icon'].includes(value),
  },
})

const ariaLabel = computed(() => props.variant === 'icon' ? 'Controle Financeiro' : undefined)
</script>

<style scoped>
.app-logo {
  min-width: 0;
  display: inline-flex;
  align-items: center;
  gap: 0.75rem;
  color: var(--text-primary, #f8fafc);
}

.app-logo-mark {
  flex: 0 0 auto;
}

.app-logo-copy {
  min-width: 0;
  display: grid;
  gap: 0.05rem;
}

.app-logo-copy strong,
.app-logo-copy small {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.app-logo-copy strong {
  font-size: 0.86rem;
  font-weight: 950;
}

.app-logo-copy small {
  color: var(--text-muted, rgba(248, 250, 252, 0.62));
  font-size: 0.66rem;
  font-weight: 800;
}

.variant-compact .app-logo-copy,
.variant-icon .app-logo-copy {
  display: none;
}
</style>
