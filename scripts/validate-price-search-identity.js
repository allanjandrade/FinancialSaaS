import assert from 'node:assert/strict'
import fs from 'node:fs'
import { assertProductIdentityMatch } from '../src/domain/products/canonicalizeProductUrl.js'

const priceSearch = fs.readFileSync('supabase/functions/price-search/index.ts', 'utf8')
const lockedIndex = priceSearch.indexOf('if (lockedIdentity)')
const genericIndex = priceSearch.indexOf('if (!hasExactMarketplaceReference && !offers.length)')

assert.ok(lockedIndex > 0, 'price-search precisa ter ramo de identidade travada.')
assert.ok(genericIndex > lockedIndex, 'Fallback generico precisa ficar depois do ramo travado.')
assert.ok(priceSearch.slice(lockedIndex, genericIndex).includes('return new Response'), 'Identidade travada precisa retornar antes do fallback generico.')
assert.ok(priceSearch.includes('assertProductIdentityMatch(identity'), 'Ofertas precisam ser comparadas contra a identidade canonica.')
assert.ok(priceSearch.includes('found_exact'), 'Produto por URL precisa usar status found_exact.')

assert.throws(() => assertProductIdentityMatch({
  source: 'mercadolivre',
  source_product_id: 'MLB45334587',
}, {
  source: 'mercadolivre',
  source_product_id: 'MLB3480874373',
  title: 'Produto divergente',
}), /mesmo produto|identidade/i)

console.log('Price search identity validation: PASS')
