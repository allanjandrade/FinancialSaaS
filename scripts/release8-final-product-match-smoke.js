import assert from 'node:assert/strict'
import { chooseBestCompatibleOffer } from '../src/utils/productCandidateScoring.js'

const identity = {
  product_type: 'auto_part',
  part_name: 'lanterna traseira',
  side: 'right',
  vehicle_make: 'Fiat',
  vehicle_model: 'Punto',
  must_match_terms: ['lanterna', 'traseira', 'punto', 'direita'],
  negative_terms: ['palio', 'siena', 'hilux'],
  match_policy: 'strict',
  side_required: true,
}

const mixedCandidates = [
  { title: 'Lanterna Traseira Siena Tampa Magneti Marelli', price: 110.25 },
  { title: 'Lanterna Traseira Hilux 2012/2015 Direita', price: 252.68 },
  { title: 'Lanterna Mala Direito Grand Siena', price: 209.61 },
  { title: 'Magneti Marelli Lanterna Fiat Palio Weekend', price: 213.21 },
  { title: 'Lanterna Fiat Palio Adventure', price: 229.77 },
  { title: 'Lanterna Traseira Direita Fiat Punto 2008 2009', price: 320.00 },
]

const incompatibleCandidates = mixedCandidates.slice(0, 4)

function assertNoLegacyBestOffer(result) {
  assert.equal(Object.prototype.hasOwnProperty.call(result, 'best_offer'), false, 'Campo legado best_offer nao pode existir.')
}

function assertRejected(result, label) {
  assert.ok(
    result.rejected.some((candidate) => candidate.title.includes(label)),
    `${label} deve ser rejected.`,
  )
  assert.equal(
    result.accepted_candidates.some((candidate) => candidate.title.includes(label)),
    false,
    `${label} nao pode ser accepted.`,
  )
}

const mixed = chooseBestCompatibleOffer(mixedCandidates, identity)
assert.equal(mixed.status, 'found_compatible')
assert.equal(mixed.best_compatible_offer.title, 'Lanterna Traseira Direita Fiat Punto 2008 2009')
assert.equal(mixed.best_compatible_offer.price, 320)
assert.equal(mixed.accepted_candidates.length, 1)
assert.equal(mixed.rejected.length, 5)
assertNoLegacyBestOffer(mixed)
assertRejected(mixed, 'Siena')
assertRejected(mixed, 'Hilux')
assertRejected(mixed, 'Grand Siena')
assertRejected(mixed, 'Palio Weekend')
assertRejected(mixed, 'Palio Adventure')

const absent = chooseBestCompatibleOffer(incompatibleCandidates, identity)
assert.equal(absent.status, 'not_found')
assert.equal(absent.best_compatible_offer, null)
assert.equal(absent.accepted_candidates.length, 0)
assert.equal(absent.rejected.length, 4)
assertNoLegacyBestOffer(absent)

console.log(JSON.stringify({
  status: 'PASS',
  mixed: {
    status: mixed.status,
    best_compatible_offer: {
      title: mixed.best_compatible_offer.title,
      price: mixed.best_compatible_offer.price,
    },
    accepted: mixed.accepted_candidates.length,
    rejected: mixed.rejected.length,
    has_legacy_best_offer: Object.prototype.hasOwnProperty.call(mixed, 'best_offer'),
  },
  noCompatible: {
    status: absent.status,
    best_compatible_offer: absent.best_compatible_offer,
    accepted: absent.accepted_candidates.length,
    rejected: absent.rejected.length,
    has_legacy_best_offer: Object.prototype.hasOwnProperty.call(absent, 'best_offer'),
  },
}, null, 2))
