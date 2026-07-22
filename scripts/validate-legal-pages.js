import assert from 'node:assert/strict'
import fs from 'node:fs'

for (const file of [
  'src/views/legal/PrivacyPolicy.vue',
  'src/views/legal/TermsOfUse.vue',
  'src/views/legal/CookiePolicy.vue',
  'src/views/public/Pricing.vue',
  'docs/legal/PRIVACY_POLICY.md',
  'docs/legal/TERMS_OF_USE.md',
  'docs/legal/COOKIE_POLICY.md',
]) {
  assert.ok(fs.existsSync(file), `Pagina/documento legal ausente: ${file}`)
}

const router = fs.readFileSync('src/router/index.js', 'utf8')
for (const route of ['/privacy', '/terms', '/cookies', '/pricing', '/signup']) {
  assert.ok(router.includes(route), `Rota publica ausente: ${route}`)
}

console.log('Legal pages validation: PASS')
