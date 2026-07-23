import assert from 'node:assert/strict'
import {
  assertProductIdentityMatch,
  canonicalizeProductUrl,
  extractProductUrls,
  productCacheKey,
} from '../src/domain/products/canonicalizeProductUrl.js'

const amazon = canonicalizeProductUrl('https://www.amazon.com.br/Blend-Cleaner-Black-500ml-Vonixx/dp/B0B3BHT71L?pf_rd_r=abc&tag=partner')
const ml = canonicalizeProductUrl('https://www.mercadolivre.com.br/p/MLB45334587?matt_tool_id=abc&tracking_id=x')
const multiple = extractProductUrls(`${amazon.canonical_url} ${ml.canonical_url}`)

assert.equal(amazon.ok, true)
assert.equal(amazon.source_product_id, 'B0B3BHT71L')
assert.equal(/teclado/i.test(amazon.title || ''), false)
assert.equal(ml.ok, true)
assert.equal(ml.source_product_id, 'MLB45334587')
assert.equal(multiple.length, 2)
assert.equal(productCacheKey(amazon), 'amazon:B0B3BHT71L')
assert.equal(productCacheKey({ source: 'mercadolivre', source_product_id: 'MLB45334587' }), 'mercadolivre:MLB45334587')
assert.throws(() => assertProductIdentityMatch(ml, {
  source: 'mercadolivre',
  source_product_id: 'MLB3480874373',
  title: 'Lanterna traseira Siena tampa Magneti Marelli',
}))

console.log(JSON.stringify({
  status: 'PASS',
  amazon_asin_extracted: amazon.source_product_id,
  amazon_title_not_keyboard: true,
  ml_catalog_id_extracted: ml.source_product_id,
  ml_wrong_item_id_blocked: true,
  multiple_urls_detected: true,
  identity_locked: true,
  cache_contamination_detected: false,
}, null, 2))
