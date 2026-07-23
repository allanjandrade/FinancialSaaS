import assert from 'node:assert/strict'
import fs from 'node:fs'
import { calculatePricingModel } from '../src/domain/billing/plans.js'

assert.ok(fs.existsSync('docs/business/RELEASE10_PRICING_MODEL.md'), 'Modelo de precificacao ausente')
const model = calculatePricingModel({ price: 19.9 })
assert.ok(model.marginPercent > 50)
assert.ok(model.breakEvenSubscribers > 0)
assert.ok(model.maxCac > 0)
console.log('Pricing model validation: PASS')
