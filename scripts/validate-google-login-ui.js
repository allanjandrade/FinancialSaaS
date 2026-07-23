import fs from 'node:fs'
import assert from 'node:assert/strict'

const button = fs.readFileSync('src/components/auth/GoogleLoginButton.vue', 'utf8')
const login = fs.readFileSync('src/views/Login.vue', 'utf8')
const signup = fs.readFileSync('src/views/Signup.vue', 'utf8')
const googleAuth = fs.readFileSync('src/domain/auth/googleAuth.js', 'utf8')
const callback = fs.readFileSync('src/views/AuthCallback.vue', 'utf8')
const testerStatus = fs.readFileSync('supabase/functions/tester-status/index.ts', 'utf8')

assert.ok(button.includes('data-testid="google-login-button"'), 'Botao Google precisa ser componente testavel.')
assert.ok(login.includes('<GoogleLoginButton v-if="googleAuthEnabled"'), 'Login precisa esconder Google quando desligado.')
assert.ok(signup.includes('<GoogleLoginButton v-if="googleAuthEnabled"'), 'Cadastro precisa esconder Google quando desligado.')
assert.ok(login.includes('<div v-if="googleAuthEnabled" class="divider"'), 'Login nao pode mostrar divisor social sem Google.')
assert.ok(signup.includes('<div v-if="googleAuthEnabled" class="divider"'), 'Cadastro nao pode mostrar divisor social sem Google.')
assert.ok(googleAuth.includes('GOOGLE_SIGNUP_BLOCKED_MESSAGE'), 'Google auth precisa mensagem de bloqueio de cadastro.')
assert.ok(googleAuth.includes('PUBLIC_SIGNUP_ENABLED'), 'Google auth precisa respeitar PUBLIC_SIGNUP_ENABLED.')
assert.ok(callback.includes('validateGoogleSignupAccess'), 'Callback precisa validar Google em ambiente controlado.')
assert.ok(callback.includes('E-mail não autorizado'), 'Callback precisa usar copy de producao para e-mail bloqueado.')
assert.ok(testerStatus.includes('tester_invites'), 'tester-status precisa considerar convites pendentes.')

console.log('Google login UI validation: PASS')
