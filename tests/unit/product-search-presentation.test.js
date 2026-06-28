import { describe, expect, it } from 'vitest'
import {
  bestComparableOffer,
  canonicalProductCode,
  offerShippingText,
  priceHistorySummary,
  productSearchStatus,
  totalComparablePrice,
} from '@/utils/product-search-presentation.js'

describe('product search presentation helpers', () => {
  it('maps locked URL products with exact compatible price to Produto confirmado', () => {
    const item = {
      identity_locked: true,
      source: 'amazon',
      source_product_id: 'B0B3BHT71L',
      price_search_status: 'found_exact',
      best_compatible_offer: {
        price: 199.9,
        shipping: 19.9,
        total: 219.8,
        compatibility_status: 'accepted',
      },
    }

    expect(productSearchStatus(item)).toMatchObject({
      label: 'Produto confirmado',
      tone: 'success',
      description: 'Identidade confirmada e oferta compativel encontrada.',
    })
    expect(canonicalProductCode(item)).toBe('amazon · B0B3BHT71L')
    expect(totalComparablePrice(item)).toBe(219.8)
  })

  it('does not surface rejected or ambiguous candidates as comparable price', () => {
    const item = {
      product_identity: { match_policy: 'strict' },
      price_search_status: 'found_ambiguous',
      last_rejected_candidates: [
        { title: 'Lanterna Traseira Siena', total: 110.25, compatibility_status: 'rejected' },
      ],
      marketplaceOffers: [
        { title: 'Lanterna Traseira Punto', total: 90, compatibility_status: 'ambiguous', match_score: 0.95 },
        { title: 'Lanterna Traseira Siena', total: 110.25, compatibility_status: 'rejected' },
      ],
    }

    expect(bestComparableOffer(item)).toBeNull()
    expect(totalComparablePrice(item)).toBeNull()
    expect(productSearchStatus(item)).toMatchObject({
      label: 'Precisa revisar',
      tone: 'warning',
    })
  })

  it('blocks stale fallback prices when explicit high-score candidates are ambiguous or rejected', () => {
    const item = {
      product_identity: { match_policy: 'strict' },
      price_search_status: 'found_compatible',
      lastQuotedPrice: 100,
      value: 100,
      last_match_score: 0.95,
      best_compatible_offer: {
        title: 'Produto parecido',
        total: 100,
        compatibility_status: 'ambiguous',
        match_score: 0.95,
      },
      accepted_candidates: [
        {
          title: 'Produto rejeitado',
          total: 90,
          compatibility_status: 'rejected',
          match_score: 0.99,
        },
      ],
    }

    expect(bestComparableOffer(item)).toBeNull()
    expect(totalComparablePrice(item)).toBeNull()
    expect(productSearchStatus(item).label).not.toBe('Produto confirmado')
  })

  it('blocks stale fallback prices when only rejected candidates are recorded', () => {
    const item = {
      product_identity: { match_policy: 'strict' },
      price_search_status: 'found_compatible',
      lastQuotedPrice: 100,
      value: 100,
      last_match_score: 0.95,
      last_rejected_candidates: [
        { title: 'Rejected', total: 100, compatibility_status: 'rejected', match_score: 0.95 },
      ],
    }

    expect(bestComparableOffer(item)).toBeNull()
    expect(totalComparablePrice(item)).toBeNull()
    expect(productSearchStatus(item).label).not.toBe('Produto confirmado')
  })

  it('blocks stale fallback prices when ambiguous candidates are recorded separately', () => {
    const item = {
      product_identity: { match_policy: 'strict' },
      price_search_status: 'found_compatible',
      lastQuotedPrice: 100,
      last_match_score: 0.95,
      ambiguous_candidates: [
        { total: 100, compatibility_status: 'ambiguous', match_score: 0.95 },
      ],
    }

    expect(totalComparablePrice(item)).toBeNull()
    expect(productSearchStatus(item).label).not.toBe('Produto confirmado')
  })

  it('never surfaces explicit ambiguous or rejected marketplace offers', () => {
    const item = {
      marketplaceOffers: [
        { title: 'Ambiguous offer', total: 90, compatibility_status: 'ambiguous', match_score: 0.99 },
        { title: 'Rejected offer', total: 80, compatibility_status: 'rejected', match_score: 0.99 },
      ],
    }

    expect(bestComparableOffer(item)).toBeNull()
    expect(totalComparablePrice(item)).toBeNull()
    expect(totalComparablePrice({ marketplaceOffers: [{ title: 'Regular offer', total: 120 }] })).toBe(120)
  })

  it('summarizes accepted price history only', () => {
    const item = {
      priceHistory: [
        { total: 300, compatibility_status: 'accepted' },
        { total: 250, compatibility_status: 'accepted' },
        { total: 110, compatibility_status: 'rejected' },
      ],
    }

    expect(priceHistorySummary(item)).toEqual({
      lowest: 250,
      average: 275,
      highest: 300,
      count: 2,
    })
  })

  it('excludes camelCase rejected price history rows', () => {
    expect(priceHistorySummary({
      priceHistory: [
        { total: 100, compatibilityStatus: 'rejected' },
        { total: 200 },
      ],
    })).toEqual({
      lowest: 200,
      average: 200,
      highest: 200,
      count: 1,
    })
  })

  it('ignores unmarked legacy history rows when compatible pricing is required', () => {
    const item = {
      identity_locked: true,
      priceHistory: [
        { total: 110 },
        { total: 100, compatibility_status: 'ambiguous', match_score: 0.95 },
        { total: 90, compatibility_status: 'rejected', match_score: 0.99 },
        { total: 250, compatibility_status: 'accepted' },
      ],
    }

    expect(priceHistorySummary(item)).toEqual({
      lowest: 250,
      average: 250,
      highest: 250,
      count: 1,
    })
  })

  it('returns shipping values including free shipping', () => {
    expect(offerShippingText({ shipping: 19.9 })).toBe(19.9)
    expect(offerShippingText({ shipping_price: 12.5 })).toBe(12.5)
    expect(offerShippingText({ shippingPrice: 8 })).toBe(8)
    expect(offerShippingText({ shipping: 0 })).toBe(0)
    expect(offerShippingText({ shipping: '0' })).toBe(0)
  })

  it('returns friendly states for pending, not found and error statuses', () => {
    expect(productSearchStatus({ priceStatus: 'pending_quote' }).label).toBe('Buscando preco')
    expect(productSearchStatus({ price_search_status: 'not_found' }).label).toBe('Nenhuma oferta compativel')
    expect(productSearchStatus({ price_search_status: 'error' }).label).toBe('Erro ao atualizar')
    expect(productSearchStatus({ monitorPrice: true, priceStatus: 'quoted' }).label).toBe('Monitorando')
  })

  it('supports camelCase identity status for locked products that need review', () => {
    expect(productSearchStatus({ identity_locked: true, identityStatus: 'needs_review' })).toMatchObject({
      label: 'Precisa revisar',
      tone: 'danger',
    })
  })
})
