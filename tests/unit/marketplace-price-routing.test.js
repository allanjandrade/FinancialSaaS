import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fetchLiveMarketplaceOffers } from '@/utils/marketplace-prices-api.js'

describe('exact marketplace lookup routing', () => {
  beforeEach(() => {
    window.SUPABASE_CONFIG = {
      url: 'https://project.supabase.co',
      anonKey: 'anon-key',
    }
    window.supabase = {
      auth: {
        getSession: vi.fn().mockResolvedValue({
          data: { session: { access_token: 'access-token' } },
        }),
      },
    }
  })

  afterEach(() => {
    vi.restoreAllMocks()
    delete window.supabase
    delete window.SUPABASE_CONFIG
  })

  it('discards a generic price result and continues to the exact Shopee resolver', async () => {
    const requestUrls = []
    vi.stubGlobal('fetch', vi.fn(async (url) => {
      requestUrls.push(String(url))
      if (String(url).endsWith('/price-search')) {
        return new Response(JSON.stringify({
          offers: [{
            marketplace: 'Ubuy',
            title: '100% Whey Gold Standard',
            price: 399,
            url: 'https://www.ubuy.com.br/product/example',
          }],
        }), { status: 200 })
      }

      return new Response(JSON.stringify({
        offers: [{
          marketplace: 'Shopee',
          title: 'Lanterna traseira direita Punto',
          price: 249.9,
          url: 'https://shopee.com.br/product/1629552564/58254957903',
        }],
        sourcesUsed: ['shopee:item'],
      }), { status: 200 })
    }))

    const result = await fetchLiveMarketplaceOffers({
      marketplace: 'Shopee',
      marketplaceItemId: '1629552564:58254957903',
      canonicalUrl: 'https://shopee.com.br/product/1629552564/58254957903',
    })

    expect(requestUrls).toEqual([
      'https://project.supabase.co/functions/v1/price-search',
      'https://project.supabase.co/functions/v1/marketplace-search',
    ])
    expect(result.offers).toHaveLength(1)
    expect(result.offers[0].title).toContain('Lanterna')
    expect(result.sourcesUsed).toEqual(['shopee:item'])
  })
})
