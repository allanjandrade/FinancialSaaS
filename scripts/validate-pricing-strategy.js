import assert from 'node:assert/strict'
import fs from 'node:fs'
import { publicPlans } from '../src/domain/billing/plans.js'

const pricing = fs.readFileSync('src/views/public/Pricing.vue', 'utf8')
const billing = fs.readFileSync('src/views/Billing.vue', 'utf8')
const planComparison = fs.readFileSync('src/components/billing/PlanComparison.vue', 'utf8')

const plans = publicPlans()
assert.deepEqual(plans.map((plan) => plan.code), ['free', 'premium_monthly', 'premium_annual'], 'Public pricing precisa ter exatamente 3 planos.')
assert.equal(plans[1].monthlyPrice, 19.9)
assert.equal(plans[2].monthlyPrice, 16.58)
assert.equal(plans[2].annualPrice, 199)

assert.ok(pricing.includes('Controle financeiro simples'), 'Gratis precisa ser controle simples.')
assert.ok(pricing.includes('Analista financeiro mensal'), 'Premium mensal precisa ser analista financeiro.')
assert.ok(pricing.includes('melhor custo-benefício'), 'Premium anual precisa comunicar custo-beneficio.')
assert.ok(billing.includes('Ideal para controlar receitas, despesas, contas e cartões de forma simples.'), 'Billing precisa explicar plano gratis.')
assert.ok(planComparison.includes('Análises, simulações, alertas e recomendações'), 'Comparacao precisa explicar Premium.')

console.log('Pricing strategy validation: PASS')
