import { ref } from 'vue'

export const toast = ref({ show: false, message: '', type: 'success' })

let hideTimer = null
const TOAST_DURATION_MS = 4000

export function showToast(message, type = 'success') {
  if (hideTimer) clearTimeout(hideTimer)
  toast.value = { show: true, message, type }
  hideTimer = setTimeout(() => {
    toast.value.show = false
    hideTimer = null
  }, TOAST_DURATION_MS)
}

export function hideToast() {
  if (hideTimer) clearTimeout(hideTimer)
  hideTimer = null
  toast.value.show = false
}

export const toastApi = {
  success(message) {
    showToast(message, 'success')
  },
  error(message) {
    showToast(message, 'error')
  },
  warning(message) {
    showToast(message, 'warning')
  },
  info(message) {
    showToast(message, 'info')
  },
}
