import { describe, expect, it } from 'vitest'
import { hideToast, showToast, toast } from '@/stores/toastStore.js'

describe('toast store', () => {
  it('shows and hides accessible toast state', () => {
    showToast('Salvo', 'success')
    expect(toast.value).toMatchObject({ show: true, message: 'Salvo', type: 'success' })
    hideToast()
    expect(toast.value.show).toBe(false)
  })
})
