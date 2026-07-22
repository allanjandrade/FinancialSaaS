<template>
  <main class="auth-page ledger-auth-page" data-testid="forgot-password-page">
    <AuthBackground />
    <section class="auth-shell auth-shell--single" aria-labelledby="forgot-password-title">
      <section class="auth-form-card" aria-label="Redefinir senha">
        <BrandMark />
        <p class="eyebrow">Conta</p>
        <h1 id="forgot-password-title">Redefinir senha</h1>
        <p class="lead">Informe o e-mail da sua conta. Enviaremos um link para você criar uma nova senha.</p>

        <form class="auth-form-fields" @submit.prevent="submit">
          <label>
            E-mail
            <input v-model.trim="email" type="email" autocomplete="email" required />
          </label>
          <button type="submit" class="primary-button" :disabled="loading">
            {{ loading ? 'Enviando...' : 'Enviar link de redefinição' }}
          </button>
        </form>

        <p v-if="success" class="success-message" role="status">{{ success }}</p>
        <p v-if="error" class="error-message" role="alert">{{ error }}</p>
        <p class="switch-link"><router-link to="/login">Voltar para login</router-link></p>
      </section>
    </section>
  </main>
</template>

<script setup>
import { ref } from 'vue'
import AuthBackground from '@/components/brand/AuthBackground.vue'
import BrandMark from '@/components/brand/BrandMark.vue'
import { getSupabaseClient } from '@/lib/supabase-client.js'
import { requestPasswordReset } from '@/domain/auth/passwordReset.js'

const email = ref('')
const loading = ref(false)
const success = ref('')
const error = ref('')

async function submit() {
  loading.value = true
  success.value = ''
  error.value = ''
  try {
    const { error: resetError } = await requestPasswordReset(getSupabaseClient(), email.value)
    if (resetError) throw resetError
    success.value = 'Se esse e-mail estiver cadastrado, enviaremos as instruções para redefinir sua senha.'
    email.value = ''
  } catch {
    error.value = 'Não foi possível solicitar a redefinição agora. Tente novamente.'
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
.lead, .switch-link { color: var(--public-text-secondary); line-height: 1.65; }
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
a { color: var(--accent); font-weight: 900; }
</style>
