import fs from 'node:fs'
import assert from 'node:assert/strict'

const header = fs.readFileSync('src/components/public/PublicHeader.vue', 'utf8')
const landing = fs.readFileSync('src/views/public/Landing.vue', 'utf8')
const pricing = fs.readFileSync('src/views/public/Pricing.vue', 'utf8')

assert.ok(header.includes('data-testid="public-header"'), 'PublicHeader precisa ser testavel')
assert.ok(header.includes('Planos'), 'PublicHeader precisa mostrar Planos')
assert.ok(header.includes('Entrar'), 'PublicHeader precisa mostrar Entrar')
assert.ok(header.includes('Criar conta'), 'PublicHeader precisa mostrar Criar conta')
assert.ok(header.includes('@media (max-width: 390px)'), 'PublicHeader precisa cobrir 390px')
assert.ok(landing.includes('<PublicHeader />'), 'Landing precisa usar PublicHeader')
assert.ok(pricing.includes('<PublicHeader />'), 'Pricing precisa usar PublicHeader')

console.log('Public header validation: PASS')
