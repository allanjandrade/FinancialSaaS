import fs from 'node:fs'
import assert from 'node:assert/strict'

const docs = [
  'docs/legal/TERMS_OF_USE.md',
  'docs/legal/PRIVACY_POLICY.md',
  'docs/legal/COOKIE_POLICY.md',
  'docs/legal/DATA_PROCESSING_NOTICE.md',
  'docs/legal/SUBSCRIPTION_CANCELLATION_REFUND_POLICY.md',
  'docs/legal/AI_CONSENT_NOTICE.md',
  'docs/legal/SECURITY_POLICY_PUBLIC.md',
  'docs/legal/LGPD_REQUEST_PROCEDURE.md',
  'docs/legal/FINANCIAL_DISCLAIMER.md',
  'docs/legal/LEGAL_PACK_CHANGELOG.md',
]
for (const file of docs) {
  assert.ok(fs.existsSync(file), `Documento ausente: ${file}`)
  const text = fs.readFileSync(file, 'utf8')
  assert.equal(/\[[A-ZÁÉÍÓÚÃÕÇ ]+\]/.test(text), false, `Documento contém placeholder: ${file}`)
}

const router = fs.readFileSync('src/router/index.js', 'utf8')
for (const route of ['/privacy', '/terms', '/cookies', '/data-processing', '/subscription-policy', '/ai-consent', '/security', '/lgpd-requests', '/financial-disclaimer']) {
  assert.ok(router.includes(`path: '${route}'`), `Rota legal ausente: ${route}`)
}

const signup = fs.readFileSync('src/views/Signup.vue', 'utf8')
assert.ok(signup.includes('data-testid="legal-acceptance"'), 'Signup precisa exigir aceite legal')
assert.ok(signup.includes('legal_acceptance_version'), 'Signup precisa registrar versão do aceite')

const landing = fs.readFileSync('src/views/public/Landing.vue', 'utf8')
assert.ok(landing.includes('/terms') && landing.includes('/privacy') && landing.includes('/cookies'), 'Landing precisa ter links legais')

console.log('Legal pack validation: PASS')
