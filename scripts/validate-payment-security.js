import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const frontend = [
  'src/views/Billing.vue',
  'src/components/billing/PaywallCard.vue',
  'src/components/billing/PlanComparison.vue',
].map((file) => fs.readFileSync(path.join(root, file), 'utf8')).join('\n')

for (const forbidden of ['SERVICE_ROLE', 'PAYMENT_SECRET', 'ASAAS_API_KEY', 'MERCADO_PAGO_ACCESS_TOKEN', 'STRIPE_SECRET_KEY']) {
  assert.equal(frontend.includes(forbidden), false, `Segredo no frontend: ${forbidden}`)
}
assert.equal(frontend.includes('finance_states'), false, 'Billing frontend nao deve enviar finance_states')
const webhook = fs.readFileSync(path.join(root, 'supabase/functions/billing-webhook/index.ts'), 'utf8')
assert.ok(webhook.includes('x-billing-signature'), 'Webhook deve validar assinatura')
console.log('Payment security validation: PASS')
