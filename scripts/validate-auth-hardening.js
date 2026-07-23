import assert from 'node:assert/strict'
import fs from 'node:fs'

const signup = fs.readFileSync('src/views/Signup.vue', 'utf8')
const authStore = fs.readFileSync('src/stores/auth.js', 'utf8')
const passwordPolicy = fs.readFileSync('src/domain/auth/passwordPolicy.js', 'utf8')
const envExample = fs.readFileSync('.env.example', 'utf8')

assert.ok(signup.includes('isPublicSignupEnabled'), 'Signup precisa usar a regra central de cadastro publico.')
assert.ok(signup.includes('Cadastro controlado'), 'Signup fechado precisa usar copy de producao.')
assert.equal(/Acesso antecipado|beta|Avise-me quando liberar/.test(signup), false, 'Signup nao pode usar copy de beta.')
assert.ok(signup.includes('minlength="12"'), 'Signup precisa exigir senha com pelo menos 12 caracteres na UI.')
assert.ok(authStore.includes('validateStrongPassword(password)'), 'Auth store precisa validar senha forte antes de signup.')
assert.ok(passwordPolicy.includes('/[A-Z]/') && passwordPolicy.includes('/[^A-Za-z0-9]/'), 'Politica de senha precisa exigir maiuscula e simbolo.')
assert.ok(envExample.includes('PUBLIC_SIGNUP_ENABLED=false'), 'Env precisa documentar signup publico controlado.')

console.log('Auth hardening validation: PASS')
