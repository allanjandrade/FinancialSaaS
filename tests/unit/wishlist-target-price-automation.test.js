import { describe, expect, it } from 'vitest'
import { evaluateWishlistTargetPriceReached } from '../../supabase/functions/_shared/automations/evaluators.js'

describe('Release 8.1 wishlist target price automation compatibility gate', () => {
  it('does not trigger for incompatible target price hits', () => {
    const financeData = {
      wishlist: [{
        id: 'punto-light',
        name: 'lanterna tras ld punto',
        product_identity: { match_policy: 'strict' },
        price_search_status: 'found_ambiguous',
        last_match_score: 0,
        value: 110.25,
        targetPrice: 350,
      }],
    }

    expect(evaluateWishlistTargetPriceReached(financeData, { purchase_item_id: 'punto-light' })).toMatchObject({
      status: 'skipped',
      triggered: false,
      code: 'PRODUCT_IDENTITY_NOT_COMPATIBLE',
    })
  })

  it('triggers only with found_compatible and accepted score', () => {
    const financeData = {
      wishlist: [{
        id: 'punto-light',
        name: 'lanterna tras ld punto',
        product_identity: { match_policy: 'strict' },
        price_search_status: 'found_compatible',
        last_match_score: 0.94,
        best_compatible_offer: { title: 'Lanterna Traseira Direita Fiat Punto 2008 2009', total: 320, match_score: 0.94 },
        targetPrice: 350,
      }],
    }

    expect(evaluateWishlistTargetPriceReached(financeData, { purchase_item_id: 'punto-light' })).toMatchObject({
      status: 'success',
      triggered: true,
    })
  })
})
