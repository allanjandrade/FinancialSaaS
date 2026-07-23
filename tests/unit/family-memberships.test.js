import fs from 'node:fs'
import { describe, expect, it } from 'vitest'
import { canManageFamilyRole, canWriteSharedEntries, familyRoleLabel } from '@/domain/family/familySharing.js'

describe('Release 11.3 family memberships', () => {
  it('keeps owner/admin management and read-only restrictions explicit', () => {
    expect(canManageFamilyRole('owner')).toBe(true)
    expect(canManageFamilyRole('admin')).toBe(true)
    expect(canManageFamilyRole('member')).toBe(false)
    expect(canWriteSharedEntries('member')).toBe(true)
    expect(canWriteSharedEntries('read_only')).toBe(false)
    expect(familyRoleLabel('read_only')).toBe('Somente leitura')
  })

  it('blocks owner mutation and removed members lose active access', () => {
    const removeFn = fs.readFileSync('supabase/functions/family-remove-member/index.ts', 'utf8')
    const roleFn = fs.readFileSync('supabase/functions/family-update-member-role/index.ts', 'utf8')
    const migration = fs.readFileSync('supabase/migrations/20260627130000_release113_family_sharing.sql', 'utf8')

    expect(removeFn).toContain("membership.role === 'owner'")
    expect(roleFn).toContain("membership.role === 'owner'")
    expect(removeFn).toContain("status: 'removed'")
    expect(migration).toContain("fm.status = 'active'")
  })
})
