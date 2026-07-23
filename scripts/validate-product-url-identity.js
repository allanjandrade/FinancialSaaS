import assert from 'node:assert/strict'
import fs from 'node:fs'
import {
  assertProductIdentityMatch,
  canonicalizeProductUrl,
  extractProductUrls,
} from '../src/domain/products/canonicalizeProductUrl.js'

const amazon = canonicalizeProductUrl('https://www.amazon.com.br/dp/B0B3BHT71L?tag=partner&pf_rd_r=abc')
assert.equal(amazon.ok, true)
assert.equal(amazon.source_product_id, 'B0B3BHT71L')
assert.equal(amazon.canonical_url, 'https://www.amazon.com.br/dp/B0B3BHT71L')

const ml = canonicalizeProductUrl('https://www.mercadolivre.com.br/p/MLB45334587?tracking_id=x')
assert.equal(ml.ok, true)
assert.equal(ml.source_product_id, 'MLB45334587')
assert.equal(ml.id_type, 'catalog_product_id')
assert.notEqual(ml.source_product_id, 'MLB3480874373')

assert.equal(extractProductUrls(`${amazon.canonical_url} ${ml.canonical_url}`).length, 2)
assert.equal(assertProductIdentityMatch(amazon, {
  source: 'amazon',
  source_product_id: 'B0B3BHT71L',
  title: 'Blend Cleaner Black 500ml Vonixx',
}), true)

const edge = fs.readFileSync('supabase/functions/product-from-url/index.ts', 'utf8')
assert.ok(edge.includes('rejectIdentityOverride(body)'), 'product-from-url precisa bloquear user_id forjado.')
assert.ok(edge.includes("status: 'multiple_urls_detected'"), 'product-from-url precisa tratar multiplos links antes de gravar.')
assert.ok(edge.includes("identity_locked: true"), 'Itens por URL precisam nascer com identidade travada.')

console.log('Product URL identity validation: PASS')
