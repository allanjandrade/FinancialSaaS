import assert from 'node:assert/strict'
import fs from 'node:fs'

const login = fs.readFileSync('src/views/Login.vue', 'utf8')
const router = fs.readFileSync('src/router/index.js', 'utf8')
const forgot = fs.readFileSync('src/views/ForgotPassword.vue', 'utf8')
const reset = fs.readFileSync('src/views/ResetPassword.vue', 'utf8')
const helper = fs.readFileSync('src/domain/auth/passwordReset.js', 'utf8')
const cypress = fs.readFileSync('cypress/e2e/release11-password-reset.cy.js', 'utf8')

assert.ok(login.includes('/forgot-password'), 'Login precisa mostrar Esqueci minha senha.')
assert.ok(router.includes("path: '/forgot-password'"), 'Rota /forgot-password obrigatoria.')
assert.ok(router.includes("path: '/reset-password'"), 'Rota /reset-password obrigatoria.')
assert.ok(forgot.includes('Se esse e-mail estiver cadastrado'), 'Forgot password precisa mensagem neutra.')
assert.equal(/e-mail.*nao.*cadastrado|email.*not.*found/i.test(forgot.normalize('NFD').replace(/[\u0300-\u036f]/g, '')), false, 'Forgot password nao pode enumerar conta.')
assert.ok(helper.includes('resetPasswordForEmail'), 'Helper precisa chamar resetPasswordForEmail.')
assert.ok(helper.includes('/reset-password'), 'Reset deve voltar para /reset-password.')
assert.ok(helper.includes('updateUser({ password })'), 'Helper precisa atualizar senha pelo Supabase Auth.')
assert.ok(reset.includes('minlength="12"'), 'Reset precisa exigir senha forte na UI.')
assert.equal(/localStorage|console\.log\(.*password|senha.*localStorage/i.test(`${forgot}\n${reset}\n${helper}`), false, 'Senha nao pode ser logada nem persistida localmente.')
assert.ok(cypress.includes('/forgot-password') && cypress.includes('/reset-password'), 'Cypress precisa cobrir forgot/reset password.')

console.log('Password reset validation: PASS')
