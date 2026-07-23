import fs from 'node:fs'
import { describe, expect, it } from 'vitest'
import { buildFamilyInviteRoute } from '@/domain/family/familySharing.js'

describe('Release 11.3 family invites', () => {
  it('uses invite route tokens without saving raw token in new records', () => {
    const migration = fs.readFileSync('supabase/migrations/20260627130000_release113_family_sharing.sql', 'utf8')
    const sender = fs.readFileSync('supabase/functions/family-send-invite/index.ts', 'utf8')
    const helper = fs.readFileSync('supabase/functions/_shared/family-sharing.ts', 'utf8')

    expect(buildFamilyInviteRoute('abc123')).toBe('/family/invite/abc123')
    expect(migration).toContain('token_hash text unique')
    expect(migration).toContain('alter column token drop default')
    expect(helper).toContain('token_hash: tokenHash')
    expect(sender).toContain("rejectControlledIdentity(body || {}, ['family_id'")
  })

  it('accepts and declines only through authenticated edge functions', () => {
    const helper = fs.readFileSync('supabase/functions/_shared/family-sharing.ts', 'utf8')
    expect(helper).toContain('sha256Hex(token)')

    for (const file of ['family-accept-invite', 'family-decline-invite', 'family-invite-preview']) {
      const source = fs.readFileSync(`supabase/functions/${file}/index.ts`, 'utf8')
      expect(source).toContain('requireAuthenticatedUser')
      expect(source).toMatch(/sha256Hex\(token\)|findInviteByTokenOrId/)
      expect(source).toContain('rejectControlledIdentity')
      expect(source).not.toContain('body.user_id')
    }
  })
})
