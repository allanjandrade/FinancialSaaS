import fs from 'node:fs'
import assert from 'node:assert/strict'

const billing = fs.readFileSync('src/views/Billing.vue', 'utf8')
const pricing = fs.readFileSync('src/views/public/Pricing.vue', 'utf8')
const plan = fs.readFileSync('src/components/billing/PlanComparison.vue', 'utf8')
const paywall = fs.readFileSync('src/components/billing/PaywallCard.vue', 'utf8')

for (const [name, source] of Object.entries({ billing, pricing, plan, paywall })) {
  assert.equal(/Avise-me quando liberar|acesso antecipado|testers autorizados|Premium em acesso antecipado/i.test(source), false, `${name} contem copy de beta.`)
}

assert.ok(billing.includes('Assinar Premium'), 'Billing precisa mostrar CTA de assinatura quando checkout permitido.')
assert.ok(billing.includes('Fazer upgrade'), 'Usuario gratis precisa ver CTA de upgrade.')
assert.ok(billing.includes('v-if="access.isPremium"'), 'Portal so deve aparecer para Premium.')
assert.ok(pricing.includes('Controle financeiro simples'), 'Plano gratis precisa comunicar controle simples.')
assert.ok(pricing.includes('Analista financeiro mensal'), 'Premium mensal precisa comunicar analista financeiro.')
assert.ok(pricing.includes('melhor custo-benefício'), 'Premium anual precisa comunicar melhor custo-beneficio.')
assert.ok(pricing.includes('R$ 16,58/mês'), 'Preco anual precisa mostrar equivalente mensal.')
assert.ok(pricing.includes('R$ 199,00 cobrados ao ano'), 'Preco anual precisa mostrar cobranca anual.')
assert.ok(plan.includes('R$ 199,00 cobrados ao ano'), 'Comparacao precisa explicar cobranca anual.')

console.log('Billing UX validation: PASS')
