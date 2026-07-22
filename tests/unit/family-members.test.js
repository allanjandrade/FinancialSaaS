import fs from 'node:fs'
import { describe, expect, it } from 'vitest'
import { FAMILY_RELATIONSHIPS, normalizeFamilyMember } from '@/domain/family/userFamilyMembers.js'

describe('Release 11.2 family members', () => {
  it('normalizes user-owned members with allowed relations', () => {
    expect(FAMILY_RELATIONSHIPS).toContain('Cônjuge')
    expect(FAMILY_RELATIONSHIPS).toContain('Filho(a)')

    expect(normalizeFamilyMember({
      name: 'Ana',
      relationship: 'Cônjuge',
      include_in_analysis: false,
      notes: 'Casa',
    }, 'user-1')).toMatchObject({
      user_id: 'user-1',
      name: 'Ana',
      relationship: 'Cônjuge',
      include_in_analysis: false,
      notes: 'Casa',
    })
    expect(() => normalizeFamilyMember({ name: '', relationship: 'Outro' }, 'user-1')).toThrow()
    expect(() => normalizeFamilyMember({ name: 'Ana', relationship: 'Amigo' }, 'user-1')).toThrow()
  })

  it('has the menu, simple page and RLS migration', () => {
    const family = fs.readFileSync('src/views/Family.vue', 'utf8')
    const navigation = fs.readFileSync('src/router/navigation.js', 'utf8')
    const migration = fs.readFileSync('supabase/migrations/20260627110000_release112_production_readiness.sql', 'utf8')

    expect(navigation).toContain("path: '/family'")
    expect(family).toContain('data-testid="family-member-form"')
    expect(migration).toContain('public.user_family_members')
    expect(migration).toContain('(select auth.uid()) = user_id')
  })
})
