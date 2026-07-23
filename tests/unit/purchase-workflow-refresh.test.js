import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useFinanceStore } from '@/stores/finance.js'
import { usePurchaseWorkflow } from '@/composables/usePurchaseWorkflow.js'
import { fetchLiveMarketplaceOffers } from '@/utils/marketplace-prices-api.js'

vi.mock('@/stores/family-sync.js', () => ({
  useFamilySyncStore: () => ({ applyingRemote: false, schedulePush: vi.fn() }),
}))

vi.mock('@/utils/marketplace-prices-api.js', async (importOriginal) => {
  const original = await importOriginal()
  return {
    ...original,
    fetchLiveMarketplaceOffers: vi.fn(),
  }
})

describe('purchase workflow price refresh', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    localStorage.clear()
    fetchLiveMarketplaceOffers.mockReset()
  })

  it('persists a refresh when the rendered item id is stale but product identity still matches', async () => {
    const store = useFinanceStore()
    store.setActiveUser('user-a')
    const workflow = usePurchaseWorkflow()
    const productIdentity = {
      source: 'mercadolivre',
      source_product_id: 'MLB123',
      id_type: 'item_id',
      match_policy: 'url_exact',
      title: 'PlayStation 5 Slim',
    }
    const current = store.addWishlistItem({
      id: 'current-id',
      name: 'PlayStation 5 Slim',
      category: 'Tecnologia',
      marketplace: 'Mercado Livre',
      marketplaceItemId: 'MLB123',
      source: 'mercadolivre',
      source_product_id: 'MLB123',
      id_type: 'item_id',
      identity_locked: true,
      product_identity: productIdentity,
      priceStatus: 'pending_quote',
    })
    const acceptedOffer = {
      title: 'PlayStation 5 Slim',
      price: 3499,
      total: 3499,
      totalPrice: 3499,
      marketplace: 'Mercado Livre',
      source: 'mercadolivre',
      source_product_id: 'MLB123',
      url: 'https://www.mercadolivre.com.br/p/MLB123',
    }
    fetchLiveMarketplaceOffers.mockResolvedValue({
      mode: 'live',
      status: 'found_exact',
      offers: [acceptedOffer],
      accepted_candidates: [acceptedOffer],
      best_compatible_offer: acceptedOffer,
      product_identity: productIdentity,
      fetchedAt: '2026-07-05T12:00:00.000Z',
    })

    const updated = await workflow.refreshItemPrices({
      ...current,
      id: 'stale-rendered-id',
    })

    expect(updated.id).toBe('current-id')
    expect(store.state.wishlist).toHaveLength(1)
    expect(store.state.wishlist[0]).toMatchObject({
      id: 'current-id',
      value: 3499,
      priceStatus: 'quoted',
      price_search_status: 'found_exact',
    })
    expect(store.state.wishlist[0].priceHistory).toHaveLength(1)
  })
})
