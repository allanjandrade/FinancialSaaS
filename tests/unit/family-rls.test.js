import fs from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('Release 11.3 family RLS contract', () => {
  it('requires active family membership for shared reads', () => {
    const migration = fs.readFileSync('supabase/migrations/20260627130000_release113_family_sharing.sql', 'utf8')

    expect(migration).toContain('public.is_family_member(target_family_group_id uuid)')
    expect(migration).toContain("fm.status = 'active'")
    expect(migration).toContain('shared_entries_select_members')
    expect(migration).toContain('shared_entry_participants_select_members')
  })

  it('requires session-created shared entries and role-based writes', () => {
    const migration = fs.readFileSync('supabase/migrations/20260627130000_release113_family_sharing.sql', 'utf8')

    expect(migration).toContain('created_by = auth.uid()')
    expect(migration).toContain('public.can_write_shared_entry(family_group_id)')
    expect(migration).toContain("family_member_role(target_family_group_id) in ('owner', 'admin')")
    expect(migration).toContain("family_member_role(target_family_group_id) in ('owner', 'admin', 'member')")
  })
})
