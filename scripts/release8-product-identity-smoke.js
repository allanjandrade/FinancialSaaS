import assert from 'node:assert/strict'
import { normalizeProductIdentity } from '../src/utils/productIdentity.js'
import { chooseBestCompatibleOffer } from '../src/utils/productCandidateScoring.js'
import { buildPurchaseIntelligence } from '../src/utils/purchase-intelligence.js'
import { evaluateWishlistTargetPriceReached } from '../supabase/functions/_shared/automations/evaluators.js'

const identity = normalizeProductIdentity('lanterna tras ld punto')
const rejectedFixture = [
  { title: 'Lanterna Traseira Siena Tampa Magneti Marelli', price: 110.25, total: 110.25 },
  { title: 'Lanterna Traseira Hilux 2012/2015 Direita', price: 252.68, total: 252.68 },
  { title: 'Lanterna Mala Direito Grand Siena', price: 209.61, total: 209.61 },
  { title: 'Magneti Marelli Lanterna Fiat Palio Weekend', price: 213.21, total: 213.21 },
  { title: 'Lanterna Fiat Palio Adventure', price: 229.77, total: 229.77 },
]
const punto = { title: 'Lanterna Traseira Direita Fiat Punto 2008 2009', price: 320, total: 320 }

const found = chooseBestCompatibleOffer([...rejectedFixture, punto], identity)
assert.equal(found.status, 'found_compatible')
assert.equal(found.best_compatible_offer.title, punto.title)
assert.equal(found.best_compatible_offer.total, 320)
assert.equal(found.accepted_candidates.length, 1)
assert.equal(found.rejected_candidates.length, 5)
for (const name of ['Siena', 'Hilux', 'Grand Siena', 'Palio Weekend', 'Palio Adventure']) {
  assert.ok(found.rejected_candidates.map((row) => row.title).join(' ').includes(name), `${name} deveria ser rejeitado.`)
}

const notFound = chooseBestCompatibleOffer(rejectedFixture, identity)
assert.equal(notFound.status, 'not_found')
assert.equal(notFound.best_compatible_offer, null)
assert.equal(notFound.accepted_candidates.length, 0)

const intelligence = buildPurchaseIntelligence({
  name: 'lanterna tras ld punto',
  value: 110.25,
  product_identity: identity,
  price_search_status: notFound.status,
  last_match_score: 0,
}, { monthlySurplus: 1000, priorityQueue: [] }, rejectedFixture)
assert.equal(intelligence.decision, 'price_identity_pending')
assert.notEqual(intelligence.opportunity.verdict, 'Excelente oportunidade')

const alert = evaluateWishlistTargetPriceReached({
  wishlist: [{
    id: 'punto-light',
    name: 'lanterna tras ld punto',
    product_identity: identity,
    price_search_status: notFound.status,
    last_match_score: 0,
    value: 110.25,
    targetPrice: 350,
  }],
}, { purchase_item_id: 'punto-light' })
assert.equal(alert.triggered, false)

console.info('Release 8.1 product identity smoke: PASS, preco compativel validado em fluxo real')
