import { toast, showToast, hideToast } from '@/stores/toastStore.js'

export function useNotification() {
  return { toast, showToast, hideToast }
}
