<template>
  <div class="avatar-uploader" data-testid="avatar-uploader">
    <UserAvatar :src="avatarUrl" :name="displayName" :email="authStore.user?.email || ''" size="lg" />
    <div class="avatar-actions">
      <input ref="fileInput" class="sr-only" type="file" accept="image/png,image/jpeg,image/webp" @change="handleFile" />
      <button type="button" class="secondary-button" aria-label="Alterar foto de perfil" data-testid="avatar-change" :disabled="profileStore.loading" @click="fileInput?.click()">
        Alterar foto
      </button>
      <button type="button" class="ghost-button" data-testid="avatar-remove" :disabled="profileStore.loading || !avatarUrl" @click="remove">
        Remover foto
      </button>
      <small>PNG, JPG ou WEBP, até 2 MB. A imagem é exibida em formato circular.</small>
      <p v-if="message" class="status-message" role="status">{{ message }}</p>
      <p v-if="error" class="error-message" role="alert">{{ error }}</p>
    </div>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'
import UserAvatar from '@/components/profile/UserAvatar.vue'
import { getSupabaseClient } from '@/lib/supabase-client.js'
import { useAuthStore } from '@/stores/auth'
import { useProfileStore } from '@/stores/profileStore.js'

const emit = defineEmits(['updated'])
const authStore = useAuthStore()
const profileStore = useProfileStore()
const fileInput = ref(null)
const message = ref('')
const error = ref('')

const avatarUrl = computed(() => profileStore.avatarUrl)
const displayName = computed(() => profileStore.displayName || authStore.user?.email?.split('@')[0] || '')

async function handleFile(event) {
  const file = event.target.files?.[0]
  if (!file) return
  message.value = ''
  error.value = ''
  try {
    const saved = await profileStore.uploadAvatar(getSupabaseClient(), authStore.user, file, {
      ...profileStore.profile,
      display_name: displayName.value,
    })
    message.value = 'Foto atualizada com sucesso.'
    emit('updated', saved)
  } catch (err) {
    error.value = err?.message || 'Não foi possível atualizar a foto. Tente novamente.'
  } finally {
    if (fileInput.value) fileInput.value.value = ''
  }
}

async function remove() {
  message.value = ''
  error.value = ''
  try {
    const saved = await profileStore.removeAvatar(getSupabaseClient(), authStore.user, profileStore.profile)
    message.value = 'Foto removida.'
    emit('updated', saved)
  } catch (err) {
    error.value = err?.message || 'Não foi possível remover a foto. Tente novamente.'
  }
}
</script>

<style scoped>
.avatar-uploader {
  display: flex;
  align-items: center;
  gap: 1rem;
  flex-wrap: wrap;
}

.avatar-actions {
  display: grid;
  gap: 0.55rem;
}

.secondary-button,
.ghost-button {
  width: fit-content;
  border-radius: 10px;
  padding: 0.72rem 0.95rem;
  font-weight: 900;
}

.secondary-button {
  border: 1px solid var(--border-color);
  background: var(--bg-input);
  color: var(--text-primary);
}

.ghost-button {
  border: 0;
  background: transparent;
  color: var(--text-secondary);
}

.secondary-button:disabled,
.ghost-button:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

small {
  color: var(--text-secondary);
  line-height: 1.6;
}

.status-message {
  margin: 0;
  color: var(--income);
  font-weight: 800;
}

.error-message {
  margin: 0;
  color: #f87171;
  font-weight: 800;
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}
</style>
