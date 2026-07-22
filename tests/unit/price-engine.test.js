import { describe, expect, it } from 'vitest'
import { normalizeOffers, scoreOfferMatch, summarizeOffers } from '../../server/price-engine.mjs'

describe('price engine', () => {
  it('returns null summary values when there are no offers', () => {
    expect(summarizeOffers([])).toEqual({
      lowestPrice: null,
      averagePrice: null,
      highestPrice: null,
      bestOffer: null,
      offerCount: 0,
    })
  })

  it('discards offers without a real price', () => {
    const offers = normalizeOffers([
      { marketplace: 'Mercado Livre', title: 'Lanterna Traseira Fiat Punto', price: 0 },
      { marketplace: 'Shopee', title: 'Lanterna Traseira Fiat Punto', price: null },
      { marketplace: 'Amazon', title: 'Lanterna Traseira Fiat Punto', price: 249.9 },
    ], { name: 'Lanterna Traseira Fiat Punto' })

    expect(offers).toHaveLength(1)
    expect(offers[0].price).toBe(249.9)
  })

  it('scores unrelated offers lower than matching offers', () => {
    const product = { name: 'Lanterna Traseira Fiat Punto 2007 2012' }
    const matching = scoreOfferMatch(product, { title: 'Lanterna Traseira Fiat Punto 2007 2008 2009 2010 2011 2012' })
    const unrelated = scoreOfferMatch(product, { title: 'Lanterna dianteira Palio universal' })

    expect(matching).toBeGreaterThan(unrelated)
    expect(unrelated).toBeLessThan(50)
  })
})
