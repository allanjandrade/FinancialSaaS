import fs from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('Release 11.2 profile avatar sync', () => {
  it('uses remote profile state and a stable Supabase Storage path', () => {
    const settings = fs.readFileSync('src/views/Settings.vue', 'utf8')
    const topbar = fs.readFileSync('src/components/Topbar.vue', 'utf8')
    const sidebar = fs.readFileSync('src/components/Sidebar.vue', 'utf8')
    const domain = fs.readFileSync('src/domain/profile/updateUserProfile.js', 'utf8')
    const migration = fs.readFileSync('supabase/migrations/20260627110000_release112_production_readiness.sql', 'utf8')

    expect(settings).toContain('<AvatarUploader')
    expect(topbar).toContain('<UserAvatar')
    expect(sidebar).toContain('<UserAvatar')
    expect(domain).toContain('avatars/${user.id}/profile.${ext}')
    expect(domain).toContain('MAX_AVATAR_BYTES = 2 * 1024 * 1024')
    expect(migration).toContain("bucket_id = 'avatars'")
    expect(`${settings}\n${topbar}\n${sidebar}\n${domain}`).not.toMatch(/base64|finance_states/)
  })
})
