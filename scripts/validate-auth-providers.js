import fs from 'node:fs'
import assert from 'node:assert/strict'

const login = fs.readFileSync('src/views/Login.vue', 'utf8')
const signup = fs.readFileSync('src/views/Signup.vue', 'utf8')
const auth = fs.readFileSync('src/stores/auth.js', 'utf8')
const googleAuth = fs.readFileSync('src/domain/auth/googleAuth.js', 'utf8')
const router = fs.readFileSync('src/router/index.js', 'utf8')
const source = [login, signup, auth, googleAuth].join('\n')

assert.equal(/facebook/i.test(source), false, 'Facebook não pode aparecer no login/cadastro/auth')
assert.ok(login.includes('Continuar com Google'), 'Login precisa oferecer Google quando habilitado')
assert.ok(signup.includes('Continuar com Google'), 'Signup precisa oferecer Google quando habilitado')
assert.ok(googleAuth.includes("provider: 'google'"), 'Google deve usar Supabase OAuth')
assert.ok(googleAuth.includes('/auth/callback'), 'Google deve voltar pelo callback')
assert.ok(router.includes("path: '/auth/callback'"), 'Rota /auth/callback obrigatória')
assert.equal(/GOOGLE_CLIENT_SECRET|refresh token|OAuth token|SUPABASE_SERVICE_ROLE/i.test(source), false, 'Segredo OAuth não pode aparecer no frontend')

console.log('Auth providers validation: PASS')
