<template>
  <main class="auth-page ledger-auth-page" data-testid="signup-page">
    <AuthBackground />
    <section class="auth-shell" aria-labelledby="signup-title">
      <section class="auth-form-card" aria-label="Criar conta">
        <BrandMark />
        <p class="eyebrow">Cadastro seguro</p>
        <h1 id="signup-title">{{ publicSignupEnabled ? 'Crie sua conta' : 'Cadastro controlado' }}</h1>
        <p class="lead">
          {{ publicSignupEnabled
            ? 'Comece a organizar suas finanças com mais clareza e segurança.'
            : 'Novos cadastros diretos estão pausados. Entre com uma conta existente ou solicite autorização ao administrador.' }}
        </p>

        <GoogleLoginButton v-if="googleAuthEnabled" :disabled="loading || (publicSignupEnabled && !acceptedLegal)" @click="handleGoogle">
          Continuar com Google
        </GoogleLoginButton>

        <template v-if="publicSignupEnabled">
          <div v-if="googleAuthEnabled" class="divider"><span>ou crie com e-mail</span></div>

          <form class="signup-form app-form-grid app-form-grid--stack" @submit.prevent="handleSignup">
            <AppInput v-model="name" label="Nome" autocomplete="name" autofocus required />
            <AppInput v-model="email" label="E-mail" type="email" autocomplete="email" required />
            <AppInput
              v-model="password"
              label="Senha"
              type="password"
              autocomplete="new-password"
              minlength="12"
              help-text="Use pelo menos 12 caracteres com maiúscula, minúscula, número e símbolo."
              required
            />
            <AppInput
              v-model="passwordConfirm"
              label="Confirmar senha"
              type="password"
              autocomplete="new-password"
              minlength="12"
              required
            />
            <label class="legal-check">
              <input v-model="acceptedLegal" type="checkbox" data-testid="legal-acceptance" />
              <span>Li e aceito os <router-link to="/terms">Termos de Uso</router-link> e a <router-link to="/privacy">Política de Privacidade</router-link>.</span>
            </label>
            <AppButton type="submit" data-testid="signup-submit" :loading="loading" :disabled="!acceptedLegal" block>
              {{ loading ? 'Criando...' : 'Criar conta' }}
            </AppButton>
          </form>
        </template>

        <form v-else class="signup-form" @submit.prevent="joinWaitlist">
          <label>
            E-mail
            <input v-model.trim="email" type="email" autocomplete="email" required />
          </label>
          <button type="submit" class="primary-button" :disabled="loading">
            Solicitar autorização
          </button>
        </form>

        <p v-if="error" class="error-message" role="alert">{{ error }}</p>
        <p v-if="success" class="success-message" role="status">{{ success }}</p>
        <p class="switch-link">Já tem conta? <router-link to="/login">Entrar</router-link></p>
      </section>

      <aside class="auth-panel-card">
        <p class="eyebrow">Primeiros passos</p>
        <h2>Organize antes de decidir</h2>
        <div class="auth-proof-grid" aria-label="Recursos iniciais">
          <article>
            <span>Cadastro</span>
            <strong>Seguro</strong>
          </article>
          <article>
            <span>Planejamento</span>
            <strong>Guiado</strong>
          </article>
          <article>
            <span>Compras</span>
            <strong>Com criterio</strong>
          </article>
        </div>
        <p>Use metas, orçamento, alertas e compras planejadas para entender melhor seu mês.</p>
        <div class="trust-box">
          <strong>Privacidade desde o cadastro</strong>
          <span>Você pode acessar as políticas antes de criar sua conta e controlar suas preferências depois.</span>
        </div>
      </aside>
    </section>
  </main>
</template>

<script setup>
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import AuthBackground from '@/components/brand/AuthBackground.vue'
import BrandMark from '@/components/brand/BrandMark.vue'
import GoogleLoginButton from '@/components/auth/GoogleLoginButton.vue'
import AppButton from '@/components/ui/AppButton.vue'
import AppInput from '@/components/ui/AppInput.vue'
import { toUserFriendlyError } from '@/domain/errors/userFriendlyErrors.js'
import { googleAuthEnabled as isGoogleAuthEnabled, publicSignupEnabled as isPublicSignupEnabled } from '@/domain/auth/googleAuth.js'
import { validateStrongPassword } from '@/domain/auth/passwordPolicy.js'
import { useAuthStore } from '@/stores/auth'

const router = useRouter()
const authStore = useAuthStore()
const name = ref('')
const email = ref('')
const password = ref('')
const passwordConfirm = ref('')
const acceptedLegal = ref(false)
const loading = ref(false)
const error = ref('')
const success = ref('')
const legalVersion = '2026-06-20-r11.2'
const googleAuthEnabled = computed(() => isGoogleAuthEnabled())
const publicSignupEnabled = computed(() => isPublicSignupEnabled())

async function handleSignup() {
  error.value = ''
  success.value = ''
  if (!acceptedLegal.value) {
    error.value = 'Para criar a conta, aceite os documentos obrigatórios.'
    return
  }
  if (password.value !== passwordConfirm.value) {
    error.value = 'As senhas não coincidem.'
    return
  }
  try {
    validateStrongPassword(password.value)
  } catch (err) {
    error.value = err.message
    return
  }
  loading.value = true
  const result = await authStore.signUp({
    email: email.value,
    password: password.value,
    metadata: {
      name: name.value,
      legal_acceptance_version: legalVersion,
      legal_accepted_at: new Date().toISOString(),
    },
  })
  loading.value = false
  if (result.success) {
    success.value = 'Conta criada com aceite registrado.'
    router.push('/onboarding')
  } else {
    error.value = result.error || 'Não foi possível criar a conta.'
  }
}

async function handleGoogle() {
  if (publicSignupEnabled.value && !acceptedLegal.value) {
    error.value = 'Aceite os documentos obrigatórios antes de continuar.'
    return
  }
  loading.value = true
  const result = await authStore.signInWithGoogle({ legalAcceptanceVersion: legalVersion })
  if (!result.success) {
    error.value = result.error || 'Não foi possível iniciar o acesso com Google.'
    loading.value = false
  }
}

function joinWaitlist() {
  error.value = ''
  success.value = 'Solicitação registrada para análise.'
}
</script>

<style scoped>
.eyebrow {
  margin: .4rem 0 0;
  color: var(--accent);
  font-family: var(--font-sans);
  font-size: var(--text-xs);
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: var(--eyebrow-letter-spacing);
}

h1, h2, p { margin: 0; }
h1 { font-family: var(--font-display); font-size: var(--page-title-size); font-weight: var(--page-title-weight); line-height: var(--page-title-line-height); letter-spacing: 0; }
h2 { font-family: var(--font-sans); font-size: var(--text-xl); line-height: 1.2; letter-spacing: 0; }
.lead, .auth-panel-card p, .trust-box span, .switch-link, .legal-check span, small { color: var(--public-text-secondary); line-height: 1.65; }

.signup-form { display: grid; gap: .85rem; }
label { display: grid; gap: .45rem; color: var(--public-text-secondary); font-weight: 700; }
input {
  width: 100%;
  border: 1px solid var(--public-border);
  border-radius: var(--radius-sm);
  padding: .85rem 1rem;
  color: var(--public-text-primary);
  background: var(--public-surface);
}

input:focus, button:focus-visible, a:focus-visible { outline: 3px solid var(--accent-glow); outline-offset: 2px; }

.primary-button {
  border: 0;
  border-radius: var(--radius-sm);
  padding: .9rem 1rem;
  font-weight: 900;
  cursor: pointer;
}
.primary-button { background: var(--accent); color: white; }
.primary-button:disabled { opacity: .62; cursor: not-allowed; }

.error-message { color: var(--danger); font-weight: 700; }
.success-message { color: var(--success); font-weight: 800; }
a { color: var(--accent); font-weight: 900; }
.legal-check { grid-template-columns: auto 1fr; align-items: start; font-weight: 600; }
.legal-check input { width: 18px; height: 18px; margin-top: .2rem; }
</style>
