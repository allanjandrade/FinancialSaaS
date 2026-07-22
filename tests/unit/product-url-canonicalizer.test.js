import { describe, expect, it } from 'vitest'
import { canonicalizeProductUrl } from '../../src/domain/products/canonicalizeProductUrl.js'
import { canonicalizeProductUrl as canonicalizeSharedProductUrl } from '../../supabase/functions/_shared/products/canonicalizeProductUrl.ts'

describe('Release 11.4 product URL canonicalizer', () => {
  it('canonicalizes Amazon by ASIN and strips tracking parameters', () => {
    const result = canonicalizeProductUrl('https://www.amazon.com.br/Blend-Cleaner-Black-500ml-Vonixx/dp/B0B3BHT71L?pf_rd_r=abc&tag=partner')

    expect(result).toMatchObject({
      ok: true,
      source: 'amazon',
      source_product_id: 'B0B3BHT71L',
      id_type: 'asin',
      canonical_url: 'https://www.amazon.com.br/dp/B0B3BHT71L',
      identity_source: 'url',
      identity_confidence: 1,
    })
    expect(result.removed_params).toEqual(['pf_rd_r', 'tag'])
  })

  it('canonicalizes Mercado Livre catalog product without inventing item ids', () => {
    const result = canonicalizeProductUrl('https://www.mercadolivre.com.br/p/MLB45334587?matt_tool_id=abc&tracking_id=x')

    expect(result).toMatchObject({
      ok: true,
      source: 'mercadolivre',
      source_product_id: 'MLB45334587',
      id_type: 'catalog_product_id',
      canonical_url: 'https://www.mercadolivre.com.br/p/MLB45334587',
    })
    expect(result.source_product_id).not.toBe('MLB3480874373')
  })

  it('canonicalizes marketplace URLs pasted without https protocol', () => {
    const amazon = canonicalizeProductUrl('www.amazon.com.br/dp/B0B3BHT71L?tag=partner')
    const mercadoLivre = canonicalizeProductUrl('mercadolivre.com.br/p/MLB45334587')

    expect(amazon).toMatchObject({
      ok: true,
      source: 'amazon',
      source_product_id: 'B0B3BHT71L',
    })
    expect(mercadoLivre).toMatchObject({
      ok: true,
      source: 'mercadolivre',
      source_product_id: 'MLB45334587',
    })
  })

  it('turns any external product URL into a unique locked identity', () => {
    const result = canonicalizeProductUrl('https://www.magazineluiza.com.br/produto/exemplo?utm_source=ads&sku=123#reviews')
    const sameProduct = canonicalizeProductUrl('magazineluiza.com.br/produto/exemplo?sku=123&utm_source=outro')
    const otherProduct = canonicalizeProductUrl('https://www.magazineluiza.com.br/produto/outro?sku=123')

    expect(result).toMatchObject({
      ok: true,
      source: 'magazineluiza.com.br',
      id_type: 'canonical_url_hash',
      canonical_url: 'https://magazineluiza.com.br/produto/exemplo?sku=123',
      marketplace: 'Magazineluiza',
    })
    expect(result.source_product_id).toMatch(/^URL_[0-9A-F]{8}$/)
    expect(sameProduct.source_product_id).toBe(result.source_product_id)
    expect(otherProduct.source_product_id).not.toBe(result.source_product_id)
  })

  it('rejects technical API URLs instead of leaking "functions" as a product name', () => {
    const technicalUrl = 'https://project-ref.supabase.co/functions/v1/product-from-url'

    expect(canonicalizeProductUrl(technicalUrl)).toMatchObject({
      ok: false,
      code: 'PRODUCT_URL_TECHNICAL_ENDPOINT',
    })
    expect(canonicalizeSharedProductUrl(technicalUrl)).toMatchObject({
      ok: false,
      code: 'PRODUCT_URL_TECHNICAL_ENDPOINT',
    })
  })

  it('uses the product slug instead of generic path folders as the fallback title', () => {
    const result = canonicalizeProductUrl('https://loja.example.com/produto/playstation-5-slim?utm_source=ads')

    expect(result).toMatchObject({
      ok: true,
      title: 'playstation 5 slim',
    })
  })
})
