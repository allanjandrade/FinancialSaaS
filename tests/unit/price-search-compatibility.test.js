import { describe, expect, it } from 'vitest'
import { normalizeProductIdentity } from '@/utils/productIdentity.js'
import { chooseBestCompatibleOffer } from '@/utils/productCandidateScoring.js'

describe('Release 8.1 price-search compatibility contract', () => {
  it('returns best_compatible_offer instead of best global price for strict auto parts', () => {
    const identity = normalizeProductIdentity('lanterna tras ld punto')
    const result = chooseBestCompatibleOffer([
      { title: 'Lanterna Traseira Siena Tampa Magneti Marelli', price: 110.25, total: 110.25, marketplace: 'Mercado Livre' },
      { title: 'Lanterna Traseira Direita Fiat Punto 2008 2009', price: 320, total: 320, marketplace: 'Mercado Livre' },
    ], identity)

    expect(result).toMatchObject({
      status: 'found_compatible',
      best_compatible_offer: expect.objectContaining({
        title: 'Lanterna Traseira Direita Fiat Punto 2008 2009',
        total: 320,
        compatibility_status: 'accepted',
      }),
    })
    expect(result.rejected_candidates[0]).toMatchObject({
      title: 'Lanterna Traseira Siena Tampa Magneti Marelli',
      compatibility_status: 'rejected',
    })
  })
})
