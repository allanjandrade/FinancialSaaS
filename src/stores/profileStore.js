import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import {
  loadUserProfile,
  removeProfileAvatar,
  updateUserProfile,
  uploadProfileAvatar,
} from '@/domain/profile/updateUserProfile.js'
import { normalizeImageUrl } from '@/utils/safe-url.js'

export const useProfileStore = defineStore('profile', () => {
  const profile = ref({
    display_name: '',
    avatar_url: '',
    avatar_path: '',
  })
  const loading = ref(false)
  const error = ref('')

  const displayName = computed(() => profile.value.display_name || '')
  const avatarUrl = computed(() => normalizeImageUrl(profile.value.avatar_url))

  function reset() {
    profile.value = { display_name: '', avatar_url: '', avatar_path: '' }
    error.value = ''
  }

  function hydrateFromUser(user) {
    if (!user) {
      reset()
      return
    }
    profile.value = {
      ...profile.value,
      display_name: user.user_metadata?.name || profile.value.display_name || user.email?.split('@')[0] || '',
      avatar_url: normalizeImageUrl(user.user_metadata?.avatar_url || profile.value.avatar_url),
      avatar_path: user.user_metadata?.avatar_path || profile.value.avatar_path || '',
    }
  }

  function applyProfile(nextProfile = {}) {
    profile.value = {
      ...profile.value,
      display_name: nextProfile.display_name ?? nextProfile.displayName ?? profile.value.display_name,
      avatar_url: normalizeImageUrl(nextProfile.avatar_url ?? nextProfile.avatarUrl ?? profile.value.avatar_url),
      avatar_path: nextProfile.avatar_path ?? nextProfile.avatarPath ?? profile.value.avatar_path,
    }
  }

  async function loadProfile(supabase, user) {
    hydrateFromUser(user)
    if (!supabase || !user?.id) return profile.value
    loading.value = true
    error.value = ''
    try {
      const loaded = await loadUserProfile(supabase, user)
      if (loaded) applyProfile(loaded)
      return profile.value
    } catch (err) {
      error.value = err?.message || 'Não foi possível carregar o perfil.'
      return profile.value
    } finally {
      loading.value = false
    }
  }

  async function saveProfile(supabase, user, patch = {}) {
    loading.value = true
    error.value = ''
    try {
      const saved = await updateUserProfile(supabase, user, patch)
      applyProfile(saved)
      return saved
    } catch (err) {
      error.value = err?.message || 'Não foi possível salvar o perfil.'
      throw err
    } finally {
      loading.value = false
    }
  }

  async function uploadAvatar(supabase, user, file, currentProfile = {}) {
    loading.value = true
    error.value = ''
    try {
      const saved = await uploadProfileAvatar(supabase, user, file, currentProfile)
      applyProfile(saved)
      return saved
    } catch (err) {
      error.value = err?.message || 'Não foi possível atualizar a foto.'
      throw err
    } finally {
      loading.value = false
    }
  }

  async function removeAvatar(supabase, user, currentProfile = {}) {
    loading.value = true
    error.value = ''
    try {
      const saved = await removeProfileAvatar(supabase, user, currentProfile)
      applyProfile(saved)
      return saved
    } catch (err) {
      error.value = err?.message || 'Não foi possível remover a foto.'
      throw err
    } finally {
      loading.value = false
    }
  }

  return {
    profile,
    loading,
    error,
    displayName,
    avatarUrl,
    reset,
    hydrateFromUser,
    applyProfile,
    loadProfile,
    saveProfile,
    uploadAvatar,
    removeAvatar,
  }
})
