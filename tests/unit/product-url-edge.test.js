import { describe, expect, it } from 'vitest'
import {
  extractMercadoLivreItemId,
  extractShopeeItemRef,
  extractProductHtmlMetadata,
  matchesMercadoLivreItem,
  productTitleMatches,
  metaContent,
  sanitizeProductUrl,
} from '../../supabase/functions/_shared/product-url.ts'

describe('shared product URL handling', () => {
  it('sanitizes ad URLs and extracts only the numeric Mercado Livre id', () => {
    const url = 'https://produto.mercadolivre.com.br/MLB-3091989768-lanterna-_JM?matt_tool=ads&gclid=token#tracking'

    expect(sanitizeProductUrl(url)).toBe(
      'https://produto.mercadolivre.com.br/MLB-3091989768-lanterna-_JM',
    )
    expect(extractMercadoLivreItemId(url)).toBe('MLB3091989768')
  })

  it('extracts exact ids from the raw HAR URL formats', () => {
    expect(extractMercadoLivreItemId(
      'https://www.mercadolivre.com.br/lanterna/up/MLBU3323247036?pdp_filters=item_id%3AMLB5518871186&from=gshop',
    )).toBe('MLB5518871186')
    expect(extractShopeeItemRef(
      'https://shopee.com.br/product/1629552564/58254957903?utm_source=google',
    )).toBe('1629552564:58254957903')
  })

  it('reads Open Graph tags regardless of attribute order', () => {
    const html = `
      <meta content="Lanterna traseira Fiat Punto" property="og:title">
      <meta content="https://http2.mlstatic.com/product.jpg" property="og:image">
      <meta content="249.90" property="og:price:amount">
    `

    expect(metaContent(html, 'og:image')).toBe('https://http2.mlstatic.com/product.jpg')
    expect(extractProductHtmlMetadata(html)).toMatchObject({
      name: 'Lanterna traseira Fiat Punto',
      value: 249.9,
      imageUrl: 'https://http2.mlstatic.com/product.jpg',
    })
  })

  it('uses JSON-LD for brand, model and attributes', () => {
    const html = `<script type="application/ld+json">${JSON.stringify({
      '@type': 'Product',
      name: 'Lanterna Punto',
      brand: { name: 'Fiat' },
      model: 'Punto 2007-2012',
      image: ['https://example.com/lanterna.jpg'],
      offers: { price: '199,90' },
      additionalProperty: [{ name: 'Lado', value: 'Direito' }],
    })}</script>`

    expect(extractProductHtmlMetadata(html)).toMatchObject({
      brand: 'Fiat',
      model: 'Punto 2007-2012',
      attributes: { Lado: 'Direito' },
    })
  })

  it('rejects a replacement page whose Mercado Livre id differs', () => {
    expect(matchesMercadoLivreItem(
      'MLB3091989768',
      'https://www.mercadolivre.com.br/par-lanterna/up/MLBU3858397067?pdp_filters=item_id%3AMLB6512830908',
    )).toBe(false)
    expect(matchesMercadoLivreItem(
      'MLB3091989768',
      'https://produto.mercadolivre.com.br/MLB-3091989768-lanterna-_JM',
    )).toBe(true)
  })

  it('rejects an unrelated title even when a source repeats the expected id', () => {
    expect(productTitleMatches(
      'lanterna traseira fiat punto 2007 2008 2009 2010 2011 2012',
      'Termostato Tsv2006-01 Original Brastemp Consul',
    )).toBe(false)
    expect(productTitleMatches(
      'lanterna traseira fiat punto 2007 2008 2009 2010 2011 2012',
      'Lanterna traseira direita Fiat Punto 2007 a 2012',
    )).toBe(true)
  })
})
