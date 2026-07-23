import { describe, it, expect } from 'vitest'
import { buildInviteUrl } from '@/api/family-supabase.js'

describe('buildInviteUrl', () => {
  it('usa VITE_APP_URL quando configurado', () => {
    expect(buildInviteUrl('abc-token')).toBe(
      'http://localhost:5173/family/invite/abc-token',
    )
  })
})
