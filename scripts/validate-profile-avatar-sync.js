import assert from 'node:assert/strict'
import fs from 'node:fs'

const uploader = fs.readFileSync('src/components/profile/AvatarUploader.vue', 'utf8')
const avatar = fs.readFileSync('src/components/profile/UserAvatar.vue', 'utf8')
const store = fs.readFileSync('src/stores/profileStore.js', 'utf8')
const domain = fs.readFileSync('src/domain/profile/updateUserProfile.js', 'utf8')
const upload = fs.readFileSync('src/domain/profile/uploadAvatar.js', 'utf8')
const topbar = fs.readFileSync('src/components/Topbar.vue', 'utf8')
const sidebar = fs.readFileSync('src/components/Sidebar.vue', 'utf8')
const settings = fs.readFileSync('src/views/Settings.vue', 'utf8')

assert.ok(uploader.includes('data-testid="avatar-uploader"'), 'AvatarUploader precisa ser testavel.')
assert.ok(avatar.includes('object-fit: cover'), 'Avatar precisa usar object-fit cover.')
assert.ok(avatar.includes('@error'), 'Avatar precisa ter fallback quando imagem quebra.')
assert.ok(store.includes('useProfileStore'), 'profileStore precisa existir.')
assert.ok(store.includes('uploadAvatar') && store.includes('removeAvatar'), 'profileStore precisa sincronizar upload/remocao.')
assert.ok(domain.includes('MAX_AVATAR_BYTES = 2 * 1024 * 1024'), 'Avatar precisa limitar 2 MB.')
assert.ok(domain.includes("`avatars/${user.id}/profile.${ext}`"), 'Avatar precisa usar path avatars/{user_id}/profile.ext.')
assert.ok(upload.includes('uploadProfileAvatar'), 'uploadAvatar.js precisa expor upload.')
assert.ok(topbar.includes('<UserAvatar'), 'Topbar precisa usar UserAvatar.')
assert.ok(sidebar.includes('<UserAvatar'), 'Sidebar precisa usar UserAvatar.')
assert.ok(settings.includes('<AvatarUploader'), 'Settings precisa usar AvatarUploader.')
assert.equal(/base64|finance_states|localStorage/.test(`${uploader}\n${store}\n${domain}`), false, 'Avatar nao pode ser salvo em base64/localStorage/finance_states.')

console.log('Profile avatar sync validation: PASS')
