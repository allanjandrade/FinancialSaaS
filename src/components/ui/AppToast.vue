<template>
  <transition name="toast-fade">
    <div
      v-if="toast.show"
      :class="['app-toast', toast.type]"
      role="alert"
      :aria-live="toast.type === 'error' ? 'assertive' : 'polite'"
      data-testid="app-toast"
    >
      <span class="app-toast__message">{{ toast.message }}</span>
      <button type="button" class="app-toast__close touch-target" aria-label="Fechar aviso" @click="hideToast">×</button>
    </div>
  </transition>
</template>

<script setup>
import { toast, hideToast } from '@/stores/toastStore.js'
</script>

<style scoped>
.app-toast {
  position: fixed;
  top: 20px;
  right: 20px;
  z-index: 10001;
  max-width: min(420px, calc(100vw - 2rem));
  min-height: 44px;
  display: flex;
  align-items: center;
  gap: 0.8rem;
  padding: 0.85rem 0.95rem;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  background: var(--bg-card);
  color: var(--text-primary);
  /* Fluid ledger exception: floating toast notification. */
  box-shadow: var(--shadow-card-hover);
  font-size: 0.9rem;
  font-weight: 600;
}

.app-toast__close {
  width: 32px;
  height: 32px;
  display: grid;
  place-items: center;
  border: 0;
  border-radius: var(--radius-sm);
  background: var(--bg-hover);
  color: var(--text-secondary);
  cursor: pointer;
}

.app-toast.success { border-color: color-mix(in srgb, var(--success) 40%, var(--border-color)); }
.app-toast.error { border-color: color-mix(in srgb, var(--danger) 45%, var(--border-color)); }
.app-toast.info { border-color: color-mix(in srgb, var(--info) 40%, var(--border-color)); }
.app-toast.warning { border-color: color-mix(in srgb, var(--warning) 40%, var(--border-color)); }

.toast-fade-enter-active,
.toast-fade-leave-active {
  transition: opacity 0.18s ease, transform 0.18s ease;
}

.toast-fade-enter-from,
.toast-fade-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}

@media (max-width: 640px) {
  .app-toast {
    top: auto;
    right: 1rem;
    bottom: calc(78px + env(safe-area-inset-bottom));
    left: 1rem;
    max-width: none;
  }

  .toast-fade-enter-from,
  .toast-fade-leave-to {
    transform: translateY(8px);
  }
}
</style>
