import { describe, expect, it } from 'vitest'
import { productCacheKey } from '../../src/domain/products/canonicalizeProductUrl.js'

describe('Release 11.4 product cache key', () => {
  it('uses marketplace source and canonical source product id', () => {
    expect(productCacheKey({ source: 'amazon', source_product_id: 'B0B3BHT71L' })).toBe('amazon:B0B3BHT71L')
    expect(productCacheKey({ source: 'mercadolivre', source_product_id: 'MLB45334587' })).toBe('mercadolivre:MLB45334587')
    expect(productCacheKey({ source: 'magazineluiza.com.br', source_product_id: 'URL_ABC12345' })).toBe('magazineluiza.com.br:URL_ABC12345')
  })

  it('does not build cache keys from generic query text', () => {
    expect(productCacheKey({ query: 'teclado bright' })).toBe('')
  })
})
