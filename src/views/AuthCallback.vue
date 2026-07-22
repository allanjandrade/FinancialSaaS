<template>
  <main class="auth-page ledger-auth-page auth-callback" data-testid="auth-callback-page">
    <AuthBackground />
    <section class="auth-shell auth-shell--single" aria-live="polite">
      <section class="auth-form-card auth-status-card" aria-label="Status do acesso">
        <BrandMark />
        <span class="status-spinner" aria-hidden="true" />
        <h1>{{ title }}</h1>
        <p>{{ message }}</p>
      </section>
    </section>
  </main>
</template>

<script setup>
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import AuthBackground from '@/components/brand/AuthBackground.vue'
import BrandMark from '@/components/brand/BrandMark.vue'
import { isNewOAuthUser, validateGoogleSignupAccess } from '@/domain/auth/googleAuth.js'
import { useAuthStore } from '@/stores/auth'

const router = useRouter()
const authStore = useAuthStore()
const title = ref('Entrando com segurança')
const message = ref('Estamos confirmando seu acesso.')

onMounted(async () => {
  try {
    const params = new URLSearchParams(window.location.search)
    const hashParams = new URLSearchParams(String(window.location.hash || '').replace(/^#/, ''))
    if (params.get('error') || hashParams.get('error')) {
      throw new Error('oauth_error')
    }
    await authStore.init()
    const session = authStore.session
    if (!session) {
      title.value = 'Não foi possível concluir o acesso'
      message.value = 'Tente entrar novamente.'
      setTimeout(() => router.replace('/login'), 800)
      return
    }
    const isNewUser = isNewOAuthUser(session)
    const googleAccess = await validateGoogleSignupAccess(window.supabase, session)
    if (!googleAccess.allowed) {
      await authStore.signOut()
      title.value = 'E-mail não autorizado'
      message.value = googleAccess.message
      setTimeout(() => router.replace('/login'), 1200)
      return
    }
    const redirect = window.localStorage.getItem('post-login-redirect')
    if (redirect) window.localStorage.removeItem('post-login-redirect')
    router.replace(isNewUser ? '/onboarding' : (redirect || '/dashboard'))
  } catch {
    title.value = 'Não foi possível concluir o acesso'
    message.value = 'Tente entrar novamente.'
    setTimeout(() => router.replace('/login'), 800)
  }
})
</script>

<style scoped>
.auth-status-card {
  justify-items: center;
  text-align: center;
}

.status-spinner {
  width: 34px;
  height: 34px;
  border: 3px solid rgba(79, 70, 229, 0.18);
  border-top-color: var(--accent);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

h1,
p {
  margin: 0;
}

p {
  color: var(--public-text-secondary);
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

@media (prefers-reduced-motion: reduce) {
  .status-spinner {
    animation: none;
  }
}
</style>
