import fs from 'node:fs'
import { describe, expect, it } from 'vitest'
import { normalizeProductIdentity } from '@/utils/productIdentity.js'
import { chooseBestCompatibleOffer } from '@/utils/productCandidateScoring.js'

describe('price-search ValueSERP compatibility contract', () => {
  it('keeps ValueSERP as raw candidate provider and promotes only compatible Punto offer', () => {
    const identity = normalizeProductIdentity('lanterna tras ld punto')
    const candidates = [
      { title: 'Lanterna Traseira Siena Tampa Magneti Marelli', total: 110.25, source: 'valueserp_google_shopping' },
      { title: 'Lanterna Traseira Hilux 2012/2015 Direita', total: 252.68, source: 'valueserp_google_shopping' },
      { title: 'Lanterna Mala Direito Grand Siena', total: 209.61, source: 'valueserp_google_shopping' },
      { title: 'Magneti Marelli Lanterna Fiat Palio Weekend', total: 213.21, source: 'valueserp_google_shopping' },
      { title: 'Lanterna Fiat Palio Adventure', total: 229.77, source: 'valueserp_google_shopping' },
      { title: 'Lanterna Traseira Direita Fiat Punto 2008 2009', total: 320, source: 'valueserp_google_shopping' },
    ]

    const result = chooseBestCompatibleOffer(candidates, identity)
    expect(result.status).toBe('found_compatible')
    expect(result.best_compatible_offer.title).toContain('Punto')
    expect(result.best_compatible_offer.total).toBe(320)
    expect(result.rejected_candidates.map((item) => item.title).join(' ')).toContain('Siena')
    expect(result.rejected_candidates.map((item) => item.title).join(' ')).toContain('Hilux')
    expect(result.accepted_candidates.map((item) => item.title).join(' ')).not.toContain('Siena')
  })

  it('price-search returns the new response contract without best_offer', () => {
    const source = fs.readFileSync('supabase/functions/price-search/index.ts', 'utf8')
    expect(source).toContain('best_compatible_offer')
    expect(source).toContain('accepted_candidates')
    expect(source).toContain('ambiguous_candidates')
    expect(source).toContain('rejected_candidates')
    expect(source).toContain('identity_required')
    expect(source).toContain('provider_error')
    expect(source).not.toContain('best_offer')
  })
})
