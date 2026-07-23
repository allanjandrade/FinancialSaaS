<template>
  <div
    class="app-skeleton"
    :style="{
      width: width,
      height: height,
      borderRadius: radius,
    }"
    aria-hidden="true"
    data-testid="app-skeleton"
  />
</template>

<script setup>
defineProps({
  width: { type: String, default: '100%' },
  height: { type: String, default: '14px' },
  radius: { type: String, default: '8px' },
})
</script>

<style scoped>
.app-skeleton {
  background: linear-gradient(
    90deg,
    color-mix(in srgb, var(--bg-hover) 88%, transparent) 0%,
    color-mix(in srgb, var(--bg-elevated) 92%, transparent) 50%,
    color-mix(in srgb, var(--bg-hover) 88%, transparent) 100%
  );
  background-size: 200% 100%;
  animation: app-skeleton-pulse 1.4s ease-in-out infinite;
}

@keyframes app-skeleton-pulse {
  0% { background-position: 100% 0; }
  100% { background-position: -100% 0; }
}
</style>
