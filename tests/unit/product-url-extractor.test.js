import { describe, expect, it } from 'vitest'
import { extractProductUrls } from '../../src/domain/products/canonicalizeProductUrl.js'

describe('Release 11.4 product URL extractor', () => {
  it('extracts multiple links without concatenating marketplace URLs', () => {
    const input = [
      'https://www.amazon.com.br/dp/B0B3BHT71L?tag=abc',
      'texto',
      'https://www.mercadolivre.com.br/p/MLB45334587?tracking_id=abc',
    ].join(' ')

    expect(extractProductUrls(input)).toEqual([
      'https://www.amazon.com.br/dp/B0B3BHT71L?tag=abc',
      'https://www.mercadolivre.com.br/p/MLB45334587?tracking_id=abc',
    ])
  })

  it('keeps a pasted URL boundary when tracking text is glued to the next URL', () => {
    const input = 'https://www.amazon.com.br/dp/B0B3BHT71L?linkCode=ll1https://www.mercadolivre.com.br/p/MLB45334587'
    expect(extractProductUrls(input)).toHaveLength(2)
  })

  it('accepts marketplace links pasted without protocol', () => {
    const input = 'www.amazon.com.br/dp/B0B3BHT71L e mercadolivre.com.br/p/MLB45334587'
    expect(extractProductUrls(input)).toEqual([
      'https://www.amazon.com.br/dp/B0B3BHT71L',
      'https://mercadolivre.com.br/p/MLB45334587',
    ])
  })

  it('accepts generic product links pasted without protocol', () => {
    const input = 'magazineluiza.com.br/produto/exemplo e www.loja.com.br/item/123?utm_source=x'
    expect(extractProductUrls(input)).toEqual([
      'https://magazineluiza.com.br/produto/exemplo',
      'https://www.loja.com.br/item/123?utm_source=x',
    ])
  })
})
