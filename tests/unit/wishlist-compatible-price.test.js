import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useFinanceStore } from '@/stores/finance.js'
import { normalizeProductIdentity } from '@/utils/productIdentity.js'

vi.mock('@/stores/family-sync.js', () => ({
  useFamilySyncStore: () => ({ applyingRemote: false, schedulePush: vi.fn() }),
}))

describe('Release 8.1 wishlist compatible price persistence', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    localStorage.clear()
  })

  it('does not store rejected offers as valid price history for strict identity items', () => {
    const store = useFinanceStore()
    store.setActiveUser('test-user')
    const item = store.addWishlistItem({
      name: 'lanterna tras ld punto',
      product_identity: normalizeProductIdentity('lanterna tras ld punto'),
      price_search_status: 'found_ambiguous',
    })

    store.addPriceSnapshot(item.id, {
      price: 110.25,
      total: 110.25,
      marketplace: 'Mercado Livre',
      compatibility_status: 'rejected',
      match_score: 0,
      offers: [{ title: 'Lanterna Traseira Siena Tampa Magneti Marelli', total: 110.25, compatibility_status: 'rejected' }],
    })

    expect(store.state.wishlist[0].priceHistory).toEqual([])
    expect(store.state.wishlist[0].lastQuotedPrice).toBe(0)
  })

  it('stores only accepted compatible offers in valid history', () => {
    const store = useFinanceStore()
    store.setActiveUser('test-user')
    const item = store.addWishlistItem({
      name: 'lanterna tras ld punto',
      product_identity: normalizeProductIdentity('lanterna tras ld punto'),
      price_search_status: 'found_compatible',
      last_match_score: 1,
    })

    store.addPriceSnapshot(item.id, {
      price: 320,
      total: 320,
      marketplace: 'Mercado Livre',
      compatibility_status: 'accepted',
      match_score: 1,
      offers: [
        { title: 'Lanterna Traseira Siena Tampa Magneti Marelli', total: 110.25, compatibility_status: 'rejected' },
        { title: 'Lanterna Traseira Direita Fiat Punto 2008 2009', total: 320, compatibility_status: 'accepted', match_score: 1 },
      ],
    })

    expect(store.state.wishlist[0].priceHistory).toHaveLength(1)
    expect(store.state.wishlist[0].priceHistory[0].offers).toEqual([
      expect.objectContaining({ title: 'Lanterna Traseira Direita Fiat Punto 2008 2009', total: 320 }),
    ])
  })

  it('removes stale legacy prices when compatibility search already failed', () => {
    localStorage.setItem('controle-financeiro-app-v2', JSON.stringify({
      settings: { year: 2026, selectedMonth: 6 },
      wishlist: [{
        id: 'legacy-punto',
        name: 'lanterna tras ld punto',
        value: 110.25,
        lastQuotedPrice: 110.25,
        price_search_status: 'not_found',
        priceStatus: 'quoted',
        last_rejected_candidates: [
          { title: 'Lanterna Traseira Siena Tampa Magneti Marelli', total: 110.25, compatibility_status: 'rejected' },
          { title: 'Lanterna Traseira Hilux 2012/2015 Direita', total: 252.68, compatibility_status: 'rejected' },
        ],
        marketplaceOffers: [
          { title: 'Lanterna Traseira Siena Tampa Magneti Marelli', total: 110.25 },
        ],
        priceHistory: [{
          at: '2026-06-18T12:00:00Z',
          total: 110.25,
          marketplace: 'Mercado Livre',
          offers: [
            { title: 'Lanterna Traseira Siena Tampa Magneti Marelli', total: 110.25 },
            { title: 'Lanterna Traseira Hilux 2012/2015 Direita', total: 252.68 },
          ],
        }],
      }],
    }))

    const store = useFinanceStore()
    store.setActiveUser('test-user')
    const item = store.state.wishlist[0]

    expect(item.value).toBeNull()
    expect(item.lastQuotedPrice).toBe(0)
    expect(item.priceStatus).toBe('pending_quote')
    expect(item.marketplaceOffers).toEqual([])
    expect(item.priceHistory).toEqual([])
    expect(item.best_compatible_offer).toBeNull()
  })
})
