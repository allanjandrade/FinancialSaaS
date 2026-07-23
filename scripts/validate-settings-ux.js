import fs from 'node:fs'
import assert from 'node:assert/strict'

const settings = fs.readFileSync('src/views/Settings.vue', 'utf8')
const avatarUploader = fs.readFileSync('src/components/profile/AvatarUploader.vue', 'utf8')
const profileDomain = fs.readFileSync('src/domain/profile/updateUserProfile.js', 'utf8')
const required = ['Conta', 'Segurança', 'Preferências', 'Privacidade e dados', 'Copiloto financeiro', 'Assinatura', 'Suporte', 'Sobre']
for (const label of required) assert.ok(settings.includes(label), `Settings sem seção: ${label}`)

assert.ok(settings.includes('<AvatarUploader'), 'Settings precisa usar AvatarUploader')
assert.ok(avatarUploader.includes('data-testid="avatar-change"'), 'Botão Alterar foto precisa existir')
assert.ok(avatarUploader.includes('handleFile'), 'Alterar foto precisa ter handler')
assert.ok(profileDomain.includes('2 * 1024 * 1024'), 'Avatar precisa validar 2 MB')
assert.ok(profileDomain.includes("image/png"), 'Avatar precisa validar formatos')
assert.equal(/Gemini|servidor|payload|finance_states|suporte@financeiro\.app/i.test(`${settings}\n${avatarUploader}`), false, 'Settings contém copy técnica ou e-mail fictício')
assert.equal(/background:\s*white|background:\s*#fff|background:\s*#ffffff/i.test(settings), false, 'Settings não deve usar card branco fixo')

console.log('Settings UX validation: PASS')
