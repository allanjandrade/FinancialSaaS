import fs from 'node:fs'
import { createPinia, setActivePinia } from 'pinia'
import { describe, expect, it, vi } from 'vitest'
import { updateUserProfile, validateAvatarFile } from '@/domain/profile/updateUserProfile.js'
import { useProfileStore } from '@/stores/profileStore.js'

describe('profile settings', () => {
  it('validates avatar format and size', () => {
    expect(() => validateAvatarFile({ type: 'image/png', size: 2 * 1024 * 1024 })).not.toThrow()
    expect(() => validateAvatarFile({ type: 'image/gif', size: 100 })).toThrow(/PNG, JPG ou WEBP/)
    expect(() => validateAvatarFile({ type: 'image/png', size: 2 * 1024 * 1024 + 1 })).toThrow(/2 MB/)
  })

  it('sanitizes avatar URLs loaded from profile metadata', () => {
    setActivePinia(createPinia())
    const profileStore = useProfileStore()

    profileStore.hydrateFromUser({
      email: 'qa@example.com',
      user_metadata: { avatar_url: 'javascript:alert(1)' },
    })
    expect(profileStore.avatarUrl).toBe('')

    profileStore.applyProfile({ avatar_url: 'https://cdn.example/avatar.png' })
    expect(profileStore.avatarUrl).toBe('https://cdn.example/avatar.png')
  })

  it('sanitizes avatar URL before saving profile data remotely', async () => {
    const upsert = vi.fn(() => ({
      select: () => ({
        single: async () => ({
          data: { user_id: 'user-1', display_name: 'QA', avatar_url: '' },
          error: null,
        }),
      }),
    }))
    const updateUser = vi.fn(async () => ({ data: {}, error: null }))
    const supabase = {
      from: () => ({ upsert }),
      auth: { updateUser },
    }

    await updateUserProfile(supabase, { id: 'user-1' }, {
      display_name: 'QA',
      avatar_url: 'javascript:alert(1)',
    })

    expect(upsert.mock.calls[0][0].avatar_url).toBe('')
    expect(updateUser).toHaveBeenCalledWith({
      data: {
        name: 'QA',
        avatar_url: '',
      },
    })
  })

  it('has profile persistence migration and UI contract', () => {
    const settings = fs.readFileSync('src/views/Settings.vue', 'utf8')
    const migration = fs.readFileSync('supabase/migrations/20260621130000_release11_profile_support_ux.sql', 'utf8')

    expect(settings).toContain('updateUserProfile')
    expect(settings).toContain('loadUserProfile')
    expect(migration).toContain('create table if not exists public.user_profiles')
    expect(migration).toContain("bucket_id = 'avatars'")
  })
})
