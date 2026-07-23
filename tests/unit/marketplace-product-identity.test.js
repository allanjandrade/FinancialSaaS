import { describe, expect, it } from 'vitest'
import { enforceExactProductIdentity } from '@/utils/marketplace-prices-api.js'

const product = {
  name: 'lanterna traseira fiat punto 2007 2008 2009 2010 2011 2012',
  marketplaceItemId: 'MLB-3091989768',
  canonicalUrl: 'https://produto.mercadolivre.com.br/MLB-3091989768-lanterna-traseira-fiat-punto-_JM',
}

describe('exact marketplace product identity', () => {
  it('rejects an unrelated title from every lookup layer', () => {
    const result = enforceExactProductIdentity(product, {
      offers: [{
        title: 'Termostato Tsv2006-01 Original Brastemp Consul',
        url: 'https://produto.mercadolivre.com.br/MLB-3091989768-termostato-_JM',
        price: 89.9,
        total: 89.9,
      }],
      metadata: {
        name: 'Termostato Tsv2006-01 Original Brastemp Consul',
        marketplaceItemId: 'MLB-3091989768',
        value: 89.9,
      },
      summary: { status: 'quoted', offerCount: 1 },
    })

    expect(result.offers).toEqual([])
    expect(result.metadata).toEqual({ marketplaceItemId: 'MLB-3091989768' })
    expect(result.summary).toMatchObject({ status: 'pending_quote', offerCount: 0 })
    expect(result.diagnostics).toContain('identity:exact-unavailable')
  })

  it('keeps an exact id with a compatible product title', () => {
    const result = enforceExactProductIdentity(product, {
      offers: [{
        title: 'Lanterna traseira direita Fiat Punto 2007 a 2012',
        url: 'https://produto.mercadolivre.com.br/MLB-3091989768-lanterna-punto-_JM',
        price: 249.9,
        total: 249.9,
      }],
      metadata: {
        name: 'Lanterna traseira direita Fiat Punto 2007 a 2012',
        marketplaceItemId: 'MLB-3091989768',
        value: 249.9,
      },
    })

    expect(result.offers).toHaveLength(1)
    expect(result.metadata.value).toBe(249.9)
    expect(result.diagnostics).toContain('identity:exact')
  })

  it('rejects generic shopping results for an exact Shopee link', () => {
    const result = enforceExactProductIdentity({
      marketplace: 'Shopee',
      marketplaceItemId: '1629552564:58254957903',
      canonicalUrl: 'https://shopee.com.br/product/1629552564/58254957903',
    }, {
      offers: [{
        title: '100% Whey Gold Standard',
        url: 'https://www.ubuy.com.br/product/example',
        price: 399,
      }],
    })

    expect(result.offers).toEqual([])
    expect(result.status).toBe('pending_quote')
    expect(result.diagnostics).toContain('identity:exact-unavailable')
  })

  it('accepts only the exact Shopee shop and item pair', () => {
    const result = enforceExactProductIdentity({
      marketplace: 'Shopee',
      marketplaceItemId: '1629552564:58254957903',
      canonicalUrl: 'https://shopee.com.br/product/1629552564/58254957903',
    }, {
      offers: [{
        title: 'Lanterna traseira direita Punto',
        url: 'https://shopee.com.br/product/1629552564/58254957903',
        price: 249.9,
      }],
      metadata: {
        name: 'Lanterna traseira direita Punto',
        marketplaceItemId: '1629552564:58254957903',
      },
    })

    expect(result.offers).toHaveLength(1)
    expect(result.diagnostics).toContain('identity:exact')
  })
})
