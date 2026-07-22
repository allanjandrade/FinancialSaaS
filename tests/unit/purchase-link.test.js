import { describe, expect, it } from 'vitest'
import {
  directPurchaseUrl,
  purchaseLinkForItem,
  purchaseOfferUrl,
  shoppingSearchUrl,
} from '@/utils/purchase-link.js'

describe('purchase link helpers', () => {
  it('uses the saved direct product URL when no current ad URL exists', () => {
    const item = {
      name: 'PlayStation 5',
      originalUrl: 'https://loja.example/produto/ps5',
    }

    expect(directPurchaseUrl(item)).toBe('https://loja.example/produto/ps5')
    expect(purchaseLinkForItem(item)).toMatchObject({
      href: 'https://loja.example/produto/ps5',
      label: 'Comprar',
      direct: true,
    })
  })

  it('uses the current compatible offer ad before canonical product URLs', () => {
    const item = {
      name: 'Lanterna Frontier 2003',
      originalUrl: 'https://www.mercadolivre.com.br/p/MLB123456',
      canonicalUrl: 'https://www.mercadolivre.com.br/p/MLB123456',
      best_compatible_offer: {
        url: 'https://produto.mercadolivre.com.br/MLB-987654-lanterna-frontier-_JM',
      },
    }

    expect(directPurchaseUrl(item)).toBe('https://produto.mercadolivre.com.br/MLB-987654-lanterna-frontier-_JM')
    expect(purchaseLinkForItem(item)).toMatchObject({
      href: 'https://produto.mercadolivre.com.br/MLB-987654-lanterna-frontier-_JM',
      label: 'Comprar',
      direct: true,
    })
  })

  it('finds URLs saved with accepted offers or nested history offers', () => {
    expect(purchaseOfferUrl({ link: 'www.loja.example/oferta' })).toBe('https://www.loja.example/oferta')
    expect(directPurchaseUrl({ link: 'www.loja.example/produto' })).toBe('https://www.loja.example/produto')

    expect(directPurchaseUrl({
      name: 'Lanterna Frontier 2003',
      accepted_candidates: [{ product_url: 'https://pecas.example/lanterna' }],
    })).toBe('https://pecas.example/lanterna')

    expect(directPurchaseUrl({
      name: 'Notebook',
      priceHistory: [{ offers: [{ productUrl: 'https://marketplace.example/notebook' }] }],
    })).toBe('https://marketplace.example/notebook')
  })

  it('builds a shopping search fallback when no direct URL exists', () => {
    const item = { name: 'Lanterna traseira Frontier 2003' }

    expect(shoppingSearchUrl(item)).toBe('https://www.google.com/search?tbm=shop&q=Lanterna%20traseira%20Frontier%202003')
    expect(purchaseLinkForItem(item)).toMatchObject({
      href: 'https://www.google.com/search?tbm=shop&q=Lanterna%20traseira%20Frontier%202003',
      label: 'Buscar oferta',
      direct: false,
    })
  })
})
