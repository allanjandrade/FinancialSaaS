<template>
  <slot v-if="allowed" />
  <PaywallCard v-else data-testid="feature-gate-paywall" @notify="$emit('notify')" />
</template>

<script setup>
import { computed } from 'vue'
import PaywallCard from '@/components/billing/PaywallCard.vue'
import { hasFeatureAccess } from '@/domain/entitlements/featureAccess.js'

const props = defineProps({
  feature: {
    type: String,
    required: true,
  },
  access: {
    type: Object,
    default: () => ({}),
  },
})

defineEmits(['notify'])

const allowed = computed(() => hasFeatureAccess(props.access, props.feature))
</script>
