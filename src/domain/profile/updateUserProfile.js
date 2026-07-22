import { normalizeImageUrl } from '@/utils/safe-url.js'

const ALLOWED_AVATAR_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp'])
const MAX_AVATAR_BYTES = 2 * 1024 * 1024

export function validateAvatarFile(file) {
  if (!file) throw new Error('Escolha uma imagem.')
  if (!ALLOWED_AVATAR_TYPES.has(file.type)) throw new Error('Use uma imagem nos formatos PNG, JPG ou WEBP.')
  if (file.size > MAX_AVATAR_BYTES) throw new Error('A imagem deve ter até 2 MB.')
}

export async function loadUserProfile(supabase, user) {
  if (!supabase || !user?.id) return null
  const { data, error } = await supabase
    .from('user_profiles')
    .select('user_id,display_name,avatar_url,avatar_path,preferred_theme,preferred_home_view,hide_sensitive_values')
    .eq('user_id', user.id)
    .maybeSingle()
  if (error) throw error
  return data
}

export async function updateUserProfile(supabase, user, patch = {}) {
  if (!supabase || !user?.id) throw new Error('Entre novamente para salvar o perfil.')
  const payload = {
    user_id: user.id,
    display_name: patch.display_name ?? patch.displayName ?? '',
    avatar_url: normalizeImageUrl(patch.avatar_url ?? patch.avatarUrl),
    avatar_path: patch.avatar_path ?? patch.avatarPath ?? null,
    preferred_theme: patch.preferred_theme ?? patch.preferredTheme ?? null,
    preferred_home_view: patch.preferred_home_view ?? patch.preferredHomeView ?? null,
    hide_sensitive_values: Boolean(patch.hide_sensitive_values ?? patch.hideSensitiveValues ?? false),
    updated_at: new Date().toISOString(),
  }
  const { data, error } = await supabase
    .from('user_profiles')
    .upsert(payload, { onConflict: 'user_id' })
    .select('user_id,display_name,avatar_url,avatar_path,preferred_theme,preferred_home_view,hide_sensitive_values')
    .single()
  if (error) throw error

  await supabase.auth.updateUser({
    data: {
      name: payload.display_name || undefined,
      avatar_url: payload.avatar_url,
    },
  })
  return data
}

export async function uploadProfileAvatar(supabase, user, file, currentProfile = {}) {
  validateAvatarFile(file)
  if (!supabase || !user?.id) throw new Error('Entre novamente para atualizar a foto.')
  const ext = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg'
  const avatarPath = `avatars/${user.id}/profile.${ext}`
  const { error: uploadError } = await supabase.storage
    .from('avatars')
    .upload(avatarPath, file, { upsert: true, contentType: file.type })
  if (uploadError) throw uploadError

  const { data: publicData } = supabase.storage.from('avatars').getPublicUrl(avatarPath)
  return updateUserProfile(supabase, user, {
    ...currentProfile,
    display_name: currentProfile.display_name || user.user_metadata?.name || user.email?.split('@')[0] || '',
    avatar_url: publicData?.publicUrl || '',
    avatar_path: avatarPath,
  })
}

export async function removeProfileAvatar(supabase, user, currentProfile = {}) {
  if (!supabase || !user?.id) throw new Error('Entre novamente para atualizar a foto.')
  if (currentProfile.avatar_path) {
    await supabase.storage.from('avatars').remove([currentProfile.avatar_path])
  }
  return updateUserProfile(supabase, user, {
    ...currentProfile,
    avatar_url: null,
    avatar_path: null,
  })
}
