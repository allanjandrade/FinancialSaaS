<template>
  <transition name="fade">
    <div v-if="show" class="modal-overlay" @click="handleOverlayClick">
      <div class="modal-content" role="dialog" aria-modal="true" @click.stop @keydown.esc="handleCancel">
        <h3>{{ title }}</h3>
        <p>{{ message }}</p>
        <div class="modal-actions">
          <button ref="cancelButton" class="btn-cancel" type="button" @click="handleCancel">
            {{ cancelLabel }}
          </button>
          <button
            class="btn-confirm"
            :class="{ destructive }"
            type="button"
            @click="handleConfirm"
          >
            {{ confirmLabel }}
          </button>
        </div>
      </div>
    </div>
  </transition>
</template>

<script setup>
import { nextTick, ref, watch } from 'vue'

const props = defineProps({
  show: Boolean,
  title: {
    type: String,
    default: 'Confirmar'
  },
  message: {
    type: String,
    default: 'Tem certeza?'
  },
  confirmLabel: {
    type: String,
    default: 'Confirmar'
  },
  cancelLabel: {
    type: String,
    default: 'Cancelar'
  },
  destructive: {
    type: Boolean,
    default: false
  },
})

const emit = defineEmits(['confirm', 'cancel'])
const cancelButton = ref(null)

watch(
  () => props.show,
  async (visible) => {
    if (!visible) return
    await nextTick()
    cancelButton.value?.focus()
  },
)

function handleConfirm() {
  emit('confirm')
}

function handleCancel() {
  emit('cancel')
}

function handleOverlayClick() {
  emit('cancel')
}
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10000;
}

.modal-content {
  background: var(--bg-card);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  padding: 2rem;
  max-width: 400px;
  width: 90%;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
}

.modal-content h3 {
  font-size: 1.25rem;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 0.75rem;
}

.modal-content p {
  color: var(--text-secondary);
  margin-bottom: 1.5rem;
}

.modal-actions {
  display: flex;
  gap: 1rem;
  justify-content: flex-end;
}

.btn-cancel,
.btn-confirm {
  min-height: 44px;
  padding: 0.75rem 1.5rem;
  border-radius: 8px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
}

.btn-cancel {
  background: transparent;
  border: 1px solid var(--border-color);
  color: var(--text-primary);
}

.btn-cancel:hover {
  background: var(--bg-hover);
}

.btn-confirm {
  background: var(--accent);
  border: none;
  color: white;
}

.btn-confirm:hover {
  background: var(--accent-hover);
  box-shadow: var(--shadow-glow);
}

.btn-confirm.destructive {
  background: var(--danger);
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
