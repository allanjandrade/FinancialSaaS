import { describe, expect, it } from 'vitest'
import {
  buildPriceMonitorResult,
  isWishlistItemMonitorable,
} from '../../supabase/functions/_shared/price-monitor.ts'

const item = {
  id: 'wish-1',
  name: 'Lanterna traseira direita Fiat Punto',
  marketplace: 'Mercado Livre',
  marketplaceItemId: 'MLB-5518871186',
  canonicalUrl: 'https://produto.mercadolivre.com.br/MLB-5518871186-lanterna-_JM',
  monitorPrice: true,
  lastQuotedPrice: 260,
  priceHistory: [{ total: 260 }],
}

describe('active price monitor', () => {
  it('only selects explicitly monitored wishlist items', () => {
    expect(isWishlistItemMonitorable(item)).toBe(true)
    expect(isWishlistItemMonitorable({ ...item, monitorPrice: false })).toBe(false)
    expect(isWishlistItemMonitorable({ ...item, id: '' })).toBe(false)
  })

  it('creates a new-low alert for the exact product', () => {
    const result = buildPriceMonitorResult(item, {
      offers: [{
        marketplace: 'Mercado Livre',
        title: 'Lanterna traseira direita Fiat Punto 2007 a 2012',
        price: 239.9,
        shipping: 0,
        total: 239.9,
        deliveryDays: 4,
        trust: 90,
        warranty: 'Media',
        score: 90,
        url: 'https://produto.mercadolivre.com.br/MLB-5518871186-lanterna-_JM',
        source: 'live',
      }],
      sourcesUsed: ['mercadolivre:item'],
    }, '2026-06-12T12:00:00.000Z')

    expect(result.status).toBe('quoted')
    expect(result.bestOffer.total).toBe(239.9)
    expect(result.alert).toMatchObject({ type: 'new_low', price: 239.9 })
    expect(result.historyEntry.offers).toHaveLength(1)
    expect(result.historyEntry.offers[0]).toMatchObject({
      marketplace: 'Mercado Livre',
      total: 239.9,
      url: 'https://produto.mercadolivre.com.br/MLB-5518871186-lanterna-_JM',
    })
  })

  it('prioritizes a target-price alert and rejects a different item', () => {
    const result = buildPriceMonitorResult({ ...item, targetPrice: 245 }, {
      offers: [
        {
          marketplace: 'Mercado Livre',
          title: 'Termostato Brastemp Consul',
          price: 89.9,
          shipping: 0,
          total: 89.9,
          deliveryDays: 4,
          trust: 90,
          warranty: 'Media',
          score: 90,
          url: 'https://produto.mercadolivre.com.br/MLB-9999999999-termostato-_JM',
          source: 'live',
        },
        {
          marketplace: 'Mercado Livre',
          title: 'Lanterna traseira Fiat Punto',
          price: 240,
          shipping: 0,
          total: 240,
          deliveryDays: 4,
          trust: 90,
          warranty: 'Media',
          score: 90,
          url: 'https://produto.mercadolivre.com.br/MLB-5518871186-lanterna-_JM',
          source: 'live',
        },
      ],
    })

    expect(result.offers).toHaveLength(1)
    expect(result.alert).toMatchObject({ type: 'target_reached', price: 240, targetPrice: 245 })
  })
})
