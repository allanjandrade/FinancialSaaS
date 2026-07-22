import assert from 'node:assert/strict'
import fs from 'node:fs'

const router = fs.readFileSync('src/router/index.js', 'utf8')
const reset = fs.readFileSync('src/views/ResetPassword.vue', 'utf8')
const helper = fs.readFileSync('src/domain/auth/passwordReset.js', 'utf8')

assert.ok(router.includes("path: '/reset-password'"), 'Rota /reset-password precisa existir.')
assert.ok(router.includes("name: 'reset-password'"), 'Rota /reset-password precisa estar nomeada.')
assert.ok(reset.includes('Criar nova senha'), 'Tela precisa renderizar Criar nova senha.')
assert.ok(reset.includes('Nova senha') && reset.includes('Confirmar nova senha'), 'Tela precisa ter campos de senha.')
assert.ok(reset.includes('preparePasswordRecoverySession'), 'Tela precisa preparar sessao de recovery.')
assert.ok(helper.includes('setSession'), 'Helper precisa consumir tokens do hash.')
assert.ok(helper.includes('replaceState'), 'Helper precisa limpar tokens da URL.')
assert.equal(/console\.log|localStorage|access_token.*localStorage/i.test(helper), false, 'Tokens nao podem ser logados nem persistidos manualmente.')

console.log('Reset password route validation: PASS')
