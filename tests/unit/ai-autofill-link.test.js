import { beforeEach, describe, expect, it, vi } from 'vitest'

const { fetchLiveMarketplaceOffers } = vi.hoisted(() => ({
  fetchLiveMarketplaceOffers: vi.fn(),
}))

vi.mock('@/utils/marketplace-prices-api.js', async (importOriginal) => ({
  ...(await importOriginal()),
  fetchLiveMarketplaceOffers,
}))

import { autofillFromLink } from '@/utils/ai-autofill.js'

describe('autofillFromLink', () => {
  beforeEach(() => fetchLiveMarketplaceOffers.mockReset())

  it('uses the canonical URL and enriches the review data', async () => {
    fetchLiveMarketplaceOffers.mockResolvedValue({
      offers: [{
        marketplace: 'Mercado Livre',
        title: 'Lanterna traseira Fiat Punto',
        price: 249.9,
        total: 249.9,
        imageUrl: 'https://http2.mlstatic.com/product.jpg',
        url: 'https://produto.mercadolivre.com.br/MLB-3091989768-lanterna-traseira-_JM',
      }],
      metadata: {
        marketplaceItemId: 'MLB-3091989768',
        brand: 'Fiat',
        model: 'Punto 2007-2012',
        attributes: { Lado: 'Direito' },
      },
    })

    const result = await autofillFromLink(
      'https://produto.mercadolivre.com.br/MLB-3091989768-lanterna-traseira-_JM?matt_tool=ads&gclid=token',
    )

    expect(fetchLiveMarketplaceOffers).toHaveBeenCalledWith(expect.objectContaining({
      marketplaceItemId: 'MLB-3091989768',
      originalLink: 'https://produto.mercadolivre.com.br/MLB-3091989768-lanterna-traseira-_JM',
    }))
    expect(result).toMatchObject({
      name: 'Lanterna traseira Fiat Punto',
      value: 249.9,
      imageUrl: 'https://http2.mlstatic.com/product.jpg',
      brand: 'Fiat',
      model: 'Punto 2007-2012',
      attributes: { Lado: 'Direito' },
    })
  })

  it('does not replace an exact item with a similar Mercado Livre result', async () => {
    fetchLiveMarketplaceOffers.mockResolvedValue({
      offers: [{
        marketplace: 'Mercado Livre',
        title: 'Par lanterna parachoque traseiro Punto Toro',
        price: 179.9,
        total: 179.9,
        imageUrl: 'https://http2.mlstatic.com/wrong-product.jpg',
        url: 'https://www.mercadolivre.com.br/par-lanterna-punto/up/MLBU3858397067?pdp_filters=item_id%3AMLB6512830908',
      }],
      metadata: {
        marketplaceItemId: 'MLB-6512830908',
        name: 'Par lanterna parachoque traseiro Punto Toro',
        value: 179.9,
        imageUrl: 'https://http2.mlstatic.com/wrong-product.jpg',
      },
    })

    const result = await autofillFromLink(
      'https://produto.mercadolivre.com.br/MLB-3091989768-lanterna-traseira-fiat-punto-2007-2008-2009-2010-2011-2012-_JM?gclid=tracking',
    )

    expect(result).toMatchObject({
      marketplaceItemId: 'MLB-3091989768',
      name: 'lanterna traseira fiat punto 2007 2008 2009 2010 2011 2012',
      offers: [],
    })
    expect(result.value).toBeUndefined()
    expect(result.imageUrl).toBeUndefined()
    expect(result.liveResult.offers).toEqual([])
    expect(result.liveResult.summary).toMatchObject({ status: 'pending_quote', offerCount: 0 })
  })

  it('rejects an unrelated product even when its URL repeats the requested id', async () => {
    fetchLiveMarketplaceOffers.mockResolvedValue({
      offers: [{
        marketplace: 'Mercado Livre',
        title: 'Termostato Tsv2006-01 Original Brastemp Consul',
        price: 89.9,
        total: 89.9,
        imageUrl: 'https://http2.mlstatic.com/thermostat.jpg',
        url: 'https://produto.mercadolivre.com.br/MLB-3091989768-termostato-brastemp-_JM',
      }],
      metadata: {
        marketplaceItemId: 'MLB-3091989768',
        name: 'Termostato Tsv2006-01 Original Brastemp Consul',
        value: 89.9,
        imageUrl: 'https://http2.mlstatic.com/thermostat.jpg',
      },
    })

    const result = await autofillFromLink(
      'https://produto.mercadolivre.com.br/MLB-3091989768-lanterna-traseira-fiat-punto-2007-2008-2009-2010-2011-2012-_JM',
    )

    expect(result.name).toBe('lanterna traseira fiat punto 2007 2008 2009 2010 2011 2012')
    expect(result.value).toBeUndefined()
    expect(result.imageUrl).toBeUndefined()
    expect(result.offers).toEqual([])
  })
})
