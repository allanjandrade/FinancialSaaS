import { describe, expect, it, vi } from 'vitest'
import { requestPasswordReset, updatePassword } from '@/domain/auth/passwordReset.js'

describe('password reset helpers', () => {
  it('requests reset with a neutral redirect target', async () => {
    const resetPasswordForEmail = vi.fn().mockResolvedValue({ error: null })
    const supabase = { auth: { resetPasswordForEmail } }

    await requestPasswordReset(supabase, 'user@example.com')

    expect(resetPasswordForEmail).toHaveBeenCalledWith('user@example.com', {
      redirectTo: 'http://localhost:3000/reset-password',
    })
  })

  it('rejects weak password and mismatched confirmation', async () => {
    const supabase = { auth: { updateUser: vi.fn() } }
    await expect(updatePassword(supabase, '123456', '123456')).rejects.toThrow(/12 caracteres/)
    await expect(updatePassword(supabase, 'StrongPass!123', 'StrongPass!124')).rejects.toThrow(/nao conferem|não conferem/)
    expect(supabase.auth.updateUser).not.toHaveBeenCalled()
  })

  it('updates a strong password through Supabase Auth', async () => {
    const updateUser = vi.fn().mockResolvedValue({ error: null })
    await updatePassword({ auth: { updateUser } }, 'StrongPass!123', 'StrongPass!123')
    expect(updateUser).toHaveBeenCalledWith({ password: 'StrongPass!123' })
  })
})
