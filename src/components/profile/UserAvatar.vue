<template>
  <span class="user-avatar" :class="[`size-${size}`]" data-testid="user-avatar" :aria-label="label">
    <img v-if="showImage" :src="safeSrc" :alt="label" @error="imageFailed = true" />
    <span v-else>{{ initials }}</span>
  </span>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { normalizeImageUrl } from '@/utils/safe-url.js'

const props = defineProps({
  src: {
    type: String,
    default: '',
  },
  name: {
    type: String,
    default: '',
  },
  email: {
    type: String,
    default: '',
  },
  size: {
    type: String,
    default: 'md',
    validator: (value) => ['sm', 'md', 'lg'].includes(value),
  },
})

const imageFailed = ref(false)
const label = computed(() => props.name || props.email || 'Usuário')
const safeSrc = computed(() => normalizeImageUrl(props.src))
const showImage = computed(() => Boolean(safeSrc.value) && !imageFailed.value)
const initials = computed(() => {
  const base = String(props.name || props.email?.split('@')[0] || 'U').trim()
  return base.split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase() || 'U'
})

watch(() => props.src, () => {
  imageFailed.value = false
})
</script>

<style scoped>
.user-avatar {
  display: inline-grid;
  place-items: center;
  overflow: hidden;
  border-radius: 50%;
  background: var(--accent);
  color: #fff;
  font-weight: 950;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.22);
}

.size-sm {
  width: 32px;
  height: 32px;
  font-size: 0.72rem;
}

.size-md {
  width: 40px;
  height: 40px;
  font-size: 0.82rem;
}

.size-lg {
  width: 96px;
  height: 96px;
  font-size: 1.6rem;
}

img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}
</style>
