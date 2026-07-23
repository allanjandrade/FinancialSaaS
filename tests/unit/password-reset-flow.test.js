import { beforeEach, describe, expect, it, vi } from 'vitest'
import { preparePasswordRecoverySession, readRecoveryParams } from '@/domain/auth/passwordReset.js'

describe('Release 11.2 password reset recovery flow', () => {
  beforeEach(() => {
    window.history.pushState({}, '', '/reset-password#access_token=token-a&refresh_token=token-b&type=recovery')
  })

  it('reads recovery tokens from hash without storing them manually', () => {
    expect(readRecoveryParams()).toMatchObject({
      accessToken: 'token-a',
      refreshToken: 'token-b',
      type: 'recovery',
    })
  })

  it('sets Supabase session and clears tokens from the URL', async () => {
    const setSession = vi.fn().mockResolvedValue({ data: { session: { user: { id: 'u1' } } }, error: null })

    const result = await preparePasswordRecoverySession({ auth: { setSession } })

    expect(setSession).toHaveBeenCalledWith({
      access_token: 'token-a',
      refresh_token: 'token-b',
    })
    expect(result.recovered).toBe(true)
    expect(window.location.hash).toBe('')
  })
})
