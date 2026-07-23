import { describe, expect, it } from 'vitest'
import { buildPurchaseIntelligence } from '@/utils/purchase-intelligence.js'
import { normalizeProductIdentity } from '@/utils/productIdentity.js'

describe('Release 8.1 purchase intelligence compatible price gate', () => {
  it('does not calculate opportunity without a compatible price', () => {
    const result = buildPurchaseIntelligence({
      name: 'lanterna tras ld punto',
      value: 110.25,
      product_identity: normalizeProductIdentity('lanterna tras ld punto'),
      price_search_status: 'found_ambiguous',
      last_match_score: 0,
    }, { monthlySurplus: 1000, priorityQueue: [] }, [
      { title: 'Lanterna Traseira Siena Tampa Magneti Marelli', total: 110.25, source: 'live' },
    ])

    expect(result).toMatchObject({
      decision: 'price_identity_pending',
      message: 'Ainda não há preço compatível suficiente para avaliar esta compra.',
      opportunity: { score: 0, priceSource: 'identity_pending' },
    })
    expect(result.opportunity.verdict).not.toBe('Excelente oportunidade')
  })

  it('does not reuse legacy stale prices after a failed compatible search', () => {
    const result = buildPurchaseIntelligence({
      name: 'lanterna tras ld punto',
      value: 110.25,
      price_search_status: 'not_found',
      last_match_score: 0,
      last_rejected_candidates: [
        { title: 'Lanterna Traseira Siena Tampa Magneti Marelli', total: 110.25, compatibility_status: 'rejected' },
      ],
      priceHistory: [{
        at: '2026-06-18T12:00:00Z',
        total: 110.25,
        marketplace: 'Mercado Livre',
      }],
    }, { monthlySurplus: 1000, priorityQueue: [] }, [
      { title: 'Lanterna Traseira Siena Tampa Magneti Marelli', total: 110.25, source: 'live' },
    ])

    expect(result.decision).toBe('price_identity_pending')
    expect(result.opportunity).toMatchObject({
      score: 0,
      currentPrice: 0,
      priceSource: 'identity_pending',
    })
    expect(result.opportunity.verdict).not.toBe('Excelente oportunidade')
  })
})
