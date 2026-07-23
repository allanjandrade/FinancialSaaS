import assert from 'node:assert/strict'
import fs from 'node:fs'

const sidebar = fs.readFileSync('src/components/Sidebar.vue', 'utf8')
const logo = fs.readFileSync('src/components/brand/AppLogo.vue', 'utf8')

assert.ok(sidebar.includes('<AppLogo'), 'Sidebar precisa usar AppLogo.')
assert.equal(sidebar.includes('<span>CF</span>'), false, 'Sidebar nao pode usar bloco CF cru.')
assert.ok(sidebar.includes('overflow-x: hidden'), 'Sidebar precisa bloquear overflow horizontal.')
assert.ok(sidebar.includes('min-width: 72px') && sidebar.includes('max-width: 260px'), 'Sidebar precisa controlar larguras.')
assert.ok(sidebar.includes('text-overflow: ellipsis'), 'Sidebar precisa truncar textos longos.')
assert.ok(sidebar.includes('max-width: 76px'), 'Badge Premium precisa ter largura maxima.')
assert.ok(sidebar.includes('sidebar-footer'), 'Botao de recolher precisa ficar no rodape.')
assert.ok(sidebar.includes('<UserAvatar'), 'Sidebar precisa refletir avatar do perfil.')
assert.ok(logo.includes('variant') && logo.includes('BrandMark'), 'AppLogo precisa ter variacoes e usar BrandMark.')

console.log('Sidebar layout validation: PASS')
