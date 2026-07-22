<template>
  <main class="auth-page ledger-auth-page" data-testid="login-page">
    <AuthBackground />

    <section class="auth-shell" aria-labelledby="login-title">
      <section class="auth-form-card" aria-label="Acesso a conta">
        <BrandMark />
        <p class="eyebrow">Acesso seguro</p>
        <h1 id="login-title">Entre na sua conta</h1>
        <p class="lead">Acesse seu painel financeiro e acompanhe suas decisoes com mais clareza.</p>

        <GoogleLoginButton v-if="googleAuthEnabled" class="oauth-button" :disabled="loading" @click="handleGoogle">
          Continuar com Google
        </GoogleLoginButton>

        <div v-if="googleAuthEnabled" class="divider"><span>ou entre com e-mail</span></div>

        <form class="login-form app-form-grid app-form-grid--stack" @submit.prevent="handleLogin">
          <AppInput
            id="email"
            v-model="email"
            label="E-mail"
            type="email"
            autocomplete="email"
            autofocus
            required
          />
          <AppInput
            id="password"
            v-model="password"
            label="Senha"
            type="password"
            autocomplete="current-password"
            required
          />
          <router-link class="forgot-link" to="/forgot-password">Esqueci minha senha</router-link>
          <AppButton type="submit" :loading="loading" block>
            {{ loading ? 'Entrando...' : 'Entrar' }}
          </AppButton>
        </form>

        <p v-if="error" class="error-message" role="alert">{{ error }}</p>
        <p class="switch-link">Ainda não tem conta? <router-link to="/signup">Criar conta</router-link></p>
      </section>

      <aside class="auth-panel-card">
        <p class="eyebrow">Operação protegida</p>
        <h2>Seu dinheiro mais organizado</h2>
        <p>Acompanhe receitas, despesas, metas e alertas em um só lugar, com privacidade e segurança.</p>

        <div class="auth-proof-grid" aria-label="Recursos do painel financeiro">
          <article>
            <span>Mes atual</span>
            <strong>Visao clara</strong>
          </article>
          <article>
            <span>Alertas</span>
            <strong>Sem surpresas</strong>
          </article>
          <article>
            <span>Compras</span>
            <strong>Planejadas</strong>
          </article>
        </div>

        <div class="trust-box">
          <strong>Seus dados, sob seu controle</strong>
          <span>Suas informações financeiras são protegidas e usadas apenas para entregar os recursos do aplicativo.</span>
        </div>
      </aside>
    </section>
  </main>
</template>

<script setup>
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AuthBackground from '@/components/brand/AuthBackground.vue'
import BrandMark from '@/components/brand/BrandMark.vue'
import GoogleLoginButton from '@/components/auth/GoogleLoginButton.vue'
import AppButton from '@/components/ui/AppButton.vue'
import AppInput from '@/components/ui/AppInput.vue'
import { toUserFriendlyError } from '@/domain/errors/userFriendlyErrors.js'
import { googleAuthEnabled as isGoogleAuthEnabled } from '@/domain/auth/googleAuth.js'
import { useAuthStore } from '@/stores/auth'

const router = useRouter()
const route = useRoute()
const authStore = useAuthStore()
const email = ref('')
const password = ref('')
const error = ref('')
const loading = ref(false)
const googleAuthEnabled = computed(() => isGoogleAuthEnabled())

async function handleLogin() {
  loading.value = true
  error.value = ''
  try {
    const result = await authStore.signIn(email.value, password.value)
    if (result.success) router.push(String(route.query.redirect || '/dashboard'))
    else error.value = result.error || 'Não foi possível entrar. Confira seus dados.'
  } catch (err) {
    error.value = toUserFriendlyError(err)
  } finally {
    loading.value = false
  }
}

async function handleGoogle() {
  loading.value = true
  error.value = ''
  if (route.query.redirect) {
    window.localStorage.setItem('post-login-redirect', String(route.query.redirect))
  }
  const result = await authStore.signInWithGoogle()
  if (!result.success) {
    error.value = result.error || 'Não foi possível iniciar o acesso com Google.'
    loading.value = false
  }
}
</script>

<style scoped>
.auth-page {
  --public-page-bg: #f8fafc;
  --public-surface: #ffffff;
  --public-elevated: #f0fdfa;
  --public-text-primary: #0f172a;
  --public-text-secondary: #475569;
  --public-text-muted: #64748b;
  --public-border: #e2e8f0;
  --public-border-strong: #cbd5e1;
  --auth-background: var(--public-page-bg);
  --auth-grid-line: rgba(15, 23, 42, .04);
  position: relative;
  min-height: 100vh;
  display: grid;
  place-items: center;
  padding: 1.25rem;
  background: var(--public-page-bg);
  color: var(--public-text-primary);
  overflow: hidden auto;
}

.auth-shell {
  position: relative;
  z-index: 1;
  width: min(1120px, 100%);
  display: grid;
  grid-template-columns: minmax(0, 0.95fr) minmax(340px, 0.85fr);
  align-items: stretch;
  gap: clamp(1rem, 3vw, 1.5rem);
}

.auth-form-card,
.auth-panel-card {
  border: 0;
  border-radius: 0;
  background: var(--public-surface);
  box-shadow: none;
}

.auth-form-card {
  display: grid;
  align-content: start;
  gap: 1rem;
  padding: clamp(1.25rem, 4vw, 2rem);
  border-right: 1px solid var(--public-border);
  background: rgba(255, 255, 255, 0.72);
}

.auth-panel-card {
  display: grid;
  align-content: center;
  gap: 1rem;
  padding: clamp(1.25rem, 4vw, 2rem);
  background: transparent;
}

.eyebrow {
  margin: .4rem 0 0;
  color: var(--accent);
  font-family: var(--font-sans);
  font-size: var(--text-xs);
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: var(--eyebrow-letter-spacing);
}

h1,
h2,
p {
  margin: 0;
}

h1,
h2,
strong {
  color: var(--public-text-primary);
}

h1 {
  font-family: var(--font-display);
  font-size: var(--page-title-size);
  font-weight: var(--page-title-weight);
  line-height: var(--page-title-line-height);
  letter-spacing: 0;
}

h2 {
  font-family: var(--font-sans);
  font-size: var(--text-xl);
  line-height: 1.2;
  letter-spacing: 0;
}

.lead,
.auth-panel-card > p,
.trust-box span,
.switch-link,
.forgot-link,
.auth-proof-grid span {
  color: var(--public-text-secondary);
  line-height: 1.65;
}

.oauth-button {
  width: 100%;
  border: 1px solid var(--public-border-strong);
  box-shadow: none;
}

.login-form {
  display: grid;
  gap: .85rem;
}

.divider {
  display: flex;
  align-items: center;
  gap: .75rem;
  color: var(--public-text-muted);
}

.divider::before,
.divider::after {
  content: "";
  flex: 1;
  height: 1px;
  background: var(--public-border);
}

.auth-proof-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  grid-auto-rows: 1fr;
  gap: 0.75rem;
}

.auth-proof-grid article {
  display: grid;
  align-content: space-between;
  gap: 0.45rem;
  min-height: 94px;
  padding: 0.85rem;
  border: 1px solid var(--public-border);
  border-radius: 0;
  background: var(--public-surface);
  box-shadow: none;
}

.auth-proof-grid strong {
  font-size: 0.92rem;
}

.trust-box {
  display: grid;
  gap: .35rem;
  padding: 1rem;
  border: 1px solid rgba(16, 185, 129, 0.2);
  border-radius: var(--radius-md);
  background: rgba(16, 185, 129, 0.08);
}

.error-message {
  color: var(--danger);
  font-weight: 700;
}

a {
  color: var(--accent);
  font-weight: 900;
}

.forgot-link {
  justify-self: start;
  color: var(--accent);
  font-weight: 800;
}

button:focus-visible,
a:focus-visible {
  outline: 3px solid var(--accent-glow);
  outline-offset: 2px;
}

@media (max-width: 880px) {
  .auth-shell { grid-template-columns: 1fr; }

  .auth-panel-card {
    order: -1;
  }
}

@media (max-width: 640px) {
  .auth-page {
    padding: 1rem;
  }

  .auth-proof-grid {
    grid-template-columns: 1fr;
  }
}
</style>
