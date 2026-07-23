import assert from 'node:assert/strict'
import fs from 'node:fs'
import { productCacheKey } from '../src/domain/products/canonicalizeProductUrl.js'

assert.equal(productCacheKey({ source: 'amazon', source_product_id: 'B0B3BHT71L' }), 'amazon:B0B3BHT71L')
assert.equal(productCacheKey({ source: 'mercadolivre', source_product_id: 'MLB45334587' }), 'mercadolivre:MLB45334587')
assert.equal(productCacheKey({ query: 'teclado bright' }), '')

const priceSearch = fs.readFileSync('supabase/functions/price-search/index.ts', 'utf8')
assert.ok(priceSearch.includes('productCacheKey(lockedIdentity)'), 'price-search precisa usar cache por source + source_product_id.')
assert.ok(priceSearch.includes('cache_key: cacheKey'), 'Log de identidade travada precisa carregar a chave canonica.')
assert.ok(priceSearch.includes('identity:url-locked'), 'Resposta precisa diagnosticar identidade travada.')

console.log('Product cache key validation: PASS')
