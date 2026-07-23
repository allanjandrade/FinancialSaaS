<template>
  <main class="auth-page ledger-auth-page" data-testid="reset-password-page">
    <AuthBackground />
    <section class="auth-shell auth-shell--single" aria-labelledby="reset-password-title">
      <section class="auth-form-card" aria-label="Criar nova senha">
        <BrandMark />
        <p class="eyebrow">Segurança</p>
        <h1 id="reset-password-title">Criar nova senha</h1>
        <p class="lead">Digite uma nova senha para acessar sua conta com segurança.</p>

        <form class="auth-form-fields" @submit.prevent="submit">
          <label>
            Nova senha
            <input v-model="password" type="password" autocomplete="new-password" minlength="12" required />
          </label>
          <label>
            Confirmar nova senha
            <input v-model="confirmPassword" type="password" autocomplete="new-password" minlength="12" required />
          </label>
          <button type="submit" class="primary-button" :disabled="loading">
            {{ loading ? 'Salvando...' : 'Salvar nova senha' }}
          </button>
        </form>

        <p v-if="success" class="success-message" role="status">{{ success }}</p>
        <p v-if="error" class="error-message" role="alert">{{ error }}</p>
      </section>
    </section>
  </main>
</template>

<script setup>
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import AuthBackground from '@/components/brand/AuthBackground.vue'
import BrandMark from '@/components/brand/BrandMark.vue'
import { getSupabaseClient } from '@/lib/supabase-client.js'
import { preparePasswordRecoverySession, updatePassword } from '@/domain/auth/passwordReset.js'

const router = useRouter()
const password = ref('')
const confirmPassword = ref('')
const loading = ref(false)
const success = ref('')
const error = ref('')

onMounted(async () => {
  try {
    await preparePasswordRecoverySession(getSupabaseClient())
  } catch (err) {
    error.value = err?.message || 'Não foi possível validar o link. Solicite um novo link e tente novamente.'
  }
})

async function submit() {
  loading.value = true
  success.value = ''
  error.value = ''
  try {
    const { error: updateError } = await updatePassword(getSupabaseClient(), password.value, confirmPassword.value)
    if (updateError) throw updateError
    password.value = ''
    confirmPassword.value = ''
    success.value = 'Senha atualizada com sucesso. Você já pode entrar novamente.'
    setTimeout(() => router.replace('/login'), 900)
  } catch (err) {
    error.value = err?.message || 'Não foi possível atualizar sua senha. Solicite um novo link e tente novamente.'
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.auth-form-fields { display: grid; gap: .85rem; }
.eyebrow { margin: 0; color: var(--accent); font-family: var(--font-sans); font-size: var(--text-xs); font-weight: 700; text-transform: uppercase; letter-spacing: var(--eyebrow-letter-spacing); }
h1, p { margin: 0; }
h1 { font-family: var(--font-display); font-size: var(--page-title-size); font-weight: var(--page-title-weight); line-height: var(--page-title-line-height); letter-spacing: 0; }
.lead { color: var(--public-text-secondary); line-height: 1.65; }
label { display: grid; gap: .45rem; color: var(--public-text-secondary); font-weight: 700; }
input {
  width: 100%;
  border: 1px solid var(--public-border);
  border-radius: var(--radius-sm);
  padding: .85rem 1rem;
  color: var(--public-text-primary);
  background: var(--public-surface);
}
.primary-button {
  border: 0;
  border-radius: var(--radius-sm);
  padding: .9rem 1rem;
  color: white;
  background: var(--accent);
  font-weight: 900;
  cursor: pointer;
}
.primary-button:disabled { opacity: .62; cursor: wait; }
.error-message { color: var(--danger); font-weight: 700; }
.success-message { color: var(--success); font-weight: 800; }
</style>
