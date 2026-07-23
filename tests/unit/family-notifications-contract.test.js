import fs from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('family invites and notifications contract', () => {
  it('creates family invite notifications without storing raw tokens', () => {
    const migration = fs.readFileSync('supabase/migrations/20260628130000_family_notifications.sql', 'utf8')
    const helper = fs.readFileSync('supabase/functions/_shared/family-sharing.ts', 'utf8')
    const sender = fs.readFileSync('supabase/functions/family-send-invite/index.ts', 'utf8')

    expect(migration).toContain("source in ('automation', 'system', 'ai_action', 'family')")
    expect(helper).toContain('findAuthUserByEmail')
    expect(helper).toContain('notifyExistingInvitedUser')
    expect(helper).toContain('createFamilyNotification')
    expect(helper).toContain('token_hash')
    expect(helper).not.toMatch(/payload:\s*\{[^}]*token[^_]/s)
    expect(sender).toContain('notifyExistingInvitedUser')
    expect(sender).toContain("rejectControlledIdentity(body || {}, ['family_id'")
  })

  it('supports authenticated pending invite fallback by invite id', () => {
    const domain = fs.readFileSync('src/domain/family/familySharing.js', 'utf8')
    const family = fs.readFileSync('src/views/Family.vue', 'utf8')
    const helper = fs.readFileSync('supabase/functions/_shared/family-sharing.ts', 'utf8')
    const accept = fs.readFileSync('supabase/functions/family-accept-invite/index.ts', 'utf8')
    const decline = fs.readFileSync('supabase/functions/family-decline-invite/index.ts', 'utf8')

    expect(domain).toContain('fetchPendingFamilyInvites')
    expect(domain).toContain('acceptFamilyInviteById')
    expect(domain).toContain('declineFamilyInviteById')
    expect(family).toContain('data-testid="family-pending-invites"')
    expect(family).toContain('acceptPendingInvite')
    expect(family).toContain('declinePendingInvite')
    expect(accept).toContain('invite_id || body.inviteId')
    expect(decline).toContain('invite_id || body.inviteId')
    expect(helper).toContain('Este convite foi enviado para outro e-mail.')
  })

  it('notifies other family members about shared entry changes but not the actor', () => {
    const helper = fs.readFileSync('supabase/functions/_shared/family-sharing.ts', 'utf8')
    const create = fs.readFileSync('supabase/functions/shared-entry-create/index.ts', 'utf8')
    const update = fs.readFileSync('supabase/functions/shared-entry-update/index.ts', 'utf8')

    expect(helper).toContain('notifyFamilyMembersOfSharedEntry')
    expect(helper).toContain("String(membership.user_id) !== String(actorUserId)")
    expect(helper).toContain("action: 'shared_entry_created'")
    expect(helper).toContain("action: 'shared_entry_updated'")
    expect(create).toContain('notifyFamilyMembersOfSharedEntry')
    expect(update).toContain('notifyFamilyMembersOfSharedEntry')
  })

  it('renders a global notification bell backed by in-app notifications', () => {
    const topbar = fs.readFileSync('src/components/Topbar.vue', 'utf8')
    const bell = fs.readFileSync('src/components/NotificationBell.vue', 'utf8')
    const api = fs.readFileSync('src/api/notifications.js', 'utf8')

    expect(topbar).toContain('<NotificationBell')
    expect(topbar).toContain("import NotificationBell from '@/components/NotificationBell.vue'")
    expect(bell).toContain('data-testid="notification-bell"')
    expect(bell).toContain('data-testid="notification-list"')
    expect(bell).toContain('markNotificationRead')
    expect(api).toContain(".from('in_app_notifications')")
    expect(api).toContain('read_at')
  })
})
