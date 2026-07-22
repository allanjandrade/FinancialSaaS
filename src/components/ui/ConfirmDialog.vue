<template>
  <ConfirmModal
    :show="show"
    :title="title"
    :message="message"
    :confirm-label="confirmLabel"
    :cancel-label="cancelLabel"
    :destructive="destructive"
    @confirm="$emit('confirm')"
    @cancel="$emit('cancel')"
  />
</template>

<script setup>
import ConfirmModal from '@/components/ConfirmModal.vue'

defineProps({
  show: Boolean,
  title: { type: String, default: 'Confirmar' },
  message: { type: String, default: 'Tem certeza?' },
  confirmLabel: { type: String, default: 'Confirmar' },
  cancelLabel: { type: String, default: 'Cancelar' },
  destructive: { type: Boolean, default: false },
})

defineEmits(['confirm', 'cancel'])
</script>
