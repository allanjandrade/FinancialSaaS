import fs from 'node:fs'
import assert from 'node:assert/strict'

const brand = fs.readFileSync('src/components/brand/BrandMark.vue', 'utf8')
const login = fs.readFileSync('src/views/Login.vue', 'utf8')
const signup = fs.readFileSync('src/views/Signup.vue', 'utf8')
const landing = fs.readFileSync('src/views/public/Landing.vue', 'utf8')
const publicHeader = fs.readFileSync('src/components/public/PublicHeader.vue', 'utf8')

assert.ok(brand.includes('shield'), 'Brand mark precisa de símbolo visual')
assert.equal(brand.includes('CF'), false, 'Brand mark não pode ser CF cru')
assert.ok(login.includes('BrandMark'), 'Login precisa usar brand mark')
assert.ok(signup.includes('BrandMark'), 'Signup precisa usar brand mark')
assert.ok(landing.includes('PublicHeader'), 'Landing precisa usar cabeçalho público')
assert.ok(publicHeader.includes('BrandMark'), 'Cabeçalho público precisa usar brand mark')

console.log('Branding validation: PASS')
