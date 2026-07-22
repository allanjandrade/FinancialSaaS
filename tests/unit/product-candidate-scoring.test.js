import { describe, expect, it } from 'vitest'
import { normalizeProductIdentity } from '@/utils/productIdentity.js'
import { chooseBestCompatibleOffer, scoreProductCandidate } from '@/utils/productCandidateScoring.js'

describe('Release 8 product candidate scoring', () => {
  it('accepts only Fiat Punto right rear light as compatible best price', () => {
    const identity = normalizeProductIdentity('lanterna tras ld punto')
    const candidates = [
      { title: 'Lanterna Traseira Siena Tampa Magneti Marelli', total: 110.25 },
      { title: 'Lanterna Traseira Hilux 2012/2015 Direita', total: 252.68 },
      { title: 'Lanterna Mala Direito Grand Siena', total: 209.61 },
      { title: 'Magneti Marelli Lanterna Fiat Palio Weekend', total: 213.21 },
      { title: 'Lanterna Fiat Palio Adventure', total: 229.77 },
      { title: 'Lanterna Traseira Direita Fiat Punto 2008 2009', total: 320 },
      { title: 'Lanterna Traseira Esquerda Fiat Punto', total: 250 },
      { title: 'Lanterna traseira universal', total: 90 },
    ]

    expect(scoreProductCandidate(candidates[5], identity)).toMatchObject({
      compatible: true,
      status: 'accepted',
      missing_terms: [],
      conflicting_terms: [],
    })
    expect(scoreProductCandidate(candidates[0], identity)).toMatchObject({ compatible: false, status: 'rejected', conflicting_terms: expect.arrayContaining(['Siena']) })
    expect(scoreProductCandidate(candidates[1], identity)).toMatchObject({ compatible: false, status: 'rejected', conflicting_terms: expect.arrayContaining(['Hilux']) })
    expect(scoreProductCandidate(candidates[2], identity)).toMatchObject({ compatible: false, status: 'rejected', conflicting_terms: expect.arrayContaining(['Siena']) })
    expect(scoreProductCandidate(candidates[3], identity)).toMatchObject({ compatible: false, status: 'rejected', conflicting_terms: expect.arrayContaining(['Palio']) })
    expect(scoreProductCandidate(candidates[4], identity)).toMatchObject({ compatible: false, status: 'rejected', conflicting_terms: expect.arrayContaining(['Palio']) })
    expect(scoreProductCandidate(candidates[6], identity)).toMatchObject({ compatible: false, status: 'rejected', reason: expect.stringContaining('Lado divergente') })
    expect(scoreProductCandidate(candidates[7], identity)).toMatchObject({ compatible: false, status: 'ambiguous', reason: expect.stringContaining('Modelo obrigatorio ausente') })

    const result = chooseBestCompatibleOffer(candidates, identity)
    expect(result.status).toBe('found_compatible')
    expect(result.best_compatible_offer.total).toBe(320)
    expect(result.rejected_candidates.map((row) => row.title).join(' ')).toContain('Siena')
  })

  it('does not promote cheaper incompatible candidates when Punto is absent', () => {
    const identity = normalizeProductIdentity('lanterna tras ld punto')
    const result = chooseBestCompatibleOffer([
      { title: 'Lanterna Traseira Siena Tampa Magneti Marelli', total: 110.25 },
      { title: 'Lanterna Traseira Hilux 2012/2015 Direita', total: 252.68 },
      { title: 'Lanterna Fiat Palio Adventure', total: 229.77 },
    ], identity)

    expect(result.status).toBe('not_found')
    expect(result.best_compatible_offer).toBeNull()
    expect(result.accepted_candidates).toEqual([])
  })
})
