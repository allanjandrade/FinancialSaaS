import { describe, expect, it } from 'vitest'
import {
  EdgeAuthError,
  authErrorDetails,
  getBearerToken,
  rejectIdentityOverride,
} from '../../supabase/functions/_shared/auth.ts'

describe('Edge authentication middleware', () => {
  it('requires a bearer token', () => {
    expect(() => getBearerToken(new Request('https://example.test'))).toThrow(EdgeAuthError)
  })

  it('extracts a valid bearer token', () => {
    const request = new Request('https://example.test', {
      headers: { Authorization: 'Bearer session-token' },
    })
    expect(getBearerToken(request)).toBe('session-token')
  })

  it('rejects identity supplied by the frontend', () => {
    try {
      rejectIdentityOverride({ user_id: 'forged-user' })
    } catch (error) {
      expect(authErrorDetails(error)).toEqual({
        status: 403,
        code: 'FORBIDDEN',
        message: 'A identidade do usuario e definida exclusivamente pela sessao autenticada.',
      })
      return
    }
    throw new Error('Expected identity override to be rejected')
  })
})
