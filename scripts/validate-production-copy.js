import assert from 'node:assert/strict'
import fs from 'node:fs'

const productionFiles = [
  'src/views/public/Landing.vue',
  'src/views/public/Pricing.vue',
  'src/views/Login.vue',
  'src/views/Signup.vue',
  'src/views/AuthCallback.vue',
  'src/views/Billing.vue',
  'src/views/Settings.vue',
  'src/views/Support.vue',
  'src/views/legal/SubscriptionPolicy.vue',
  'src/components/billing/PaywallCard.vue',
  'src/components/billing/PlanComparison.vue',
  'src/domain/support/staticFaq.js',
  'src/domain/access-control.js',
]

const forbidden = [
  /beta/i,
  /acesso antecipado/i,
  /testers autorizados/i,
  /avise-me quando liberar/i,
  /ainda não liberado/i,
  /ainda nao liberado/i,
  /Premium em acesso/i,
]

for (const file of productionFiles) {
  const source = fs.readFileSync(file, 'utf8')
  for (const pattern of forbidden) {
    assert.equal(pattern.test(source), false, `${file} contem copy de producao proibida: ${pattern}`)
  }
}

console.log('Production copy validation: PASS')
