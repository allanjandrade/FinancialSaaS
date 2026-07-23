import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { usePurchaseWorkflow } from '@/composables/usePurchaseWorkflow.js'
import { fetchLiveMarketplaceOffers } from '@/utils/marketplace-prices-api.js'
import { useFinanceStore } from '@/stores/finance.js'

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

describe('purchase workflow description search', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    localStorage.clear()
    fetchLiveMarketplaceOffers.mockReset()
    window.supabase = {
      auth: {
        getUser: vi.fn(async () => ({ data: { user: { id: 'user-a' } }, error: null })),
        getSession: vi.fn(async () => ({ data: { session: { access_token: 'token-a' } }, error: null })),
      },
    }
  })

  it('enriches a text description with compatible price and product image before saving', async () => {
    const workflow = usePurchaseWorkflow()
    const offer = {
      marketplace: 'Mercado Livre',
      title: 'Lanterna Traseira Direita Nissan Frontier 2003',
      price: 289.9,
      total: 289.9,
      totalPrice: 289.9,
      imageUrl: 'https://http2.mlstatic.com/frontier-lanterna.jpg',
      url: 'https://produto.mercadolivre.com.br/MLB-123-lanterna-frontier',
      compatibility_status: 'accepted',
      match_score: 1,
      match_reason: 'Contem lanterna traseira, lado direito e Frontier.',
    }
    fetchLiveMarketplaceOffers.mockResolvedValue({
      mode: 'live',
      status: 'found_compatible',
      offers: [offer],
      accepted_candidates: [offer],
      best_compatible_offer: offer,
      product_identity: {
        product_type: 'auto_part',
        part_name: 'lanterna traseira',
        side: 'right',
        vehicle_make: 'Nissan',
        vehicle_model: 'Frontier',
        match_policy: 'strict',
      },
      metadata: {
        imageUrl: 'https://http2.mlstatic.com/frontier-lanterna.jpg',
        marketplace: 'Mercado Livre',
      },
    })

    const result = await workflow.identifyFromText('lanterna traseira direita frontier 2003')

    expect(fetchLiveMarketplaceOffers).toHaveBeenCalledWith(expect.objectContaining({
      name: 'lanterna traseira direita Nissan Frontier 2003',
      product_identity: expect.objectContaining({
        vehicle_make: 'Nissan',
        vehicle_model: 'Frontier',
        side: 'right',
      }),
    }))
    expect(result).toMatchObject({
      name: 'Lanterna Traseira Direita Nissan Frontier 2003',
      value: 289.9,
      imageUrl: 'https://http2.mlstatic.com/frontier-lanterna.jpg',
      marketplace: 'Mercado Livre',
      price_search_status: 'found_compatible',
      priceStatus: 'quoted',
    })
    expect(result.liveResult.best_compatible_offer).toMatchObject({
      title: 'Lanterna Traseira Direita Nissan Frontier 2003',
    })
  })

  it('returns all immediate marketplace results for a text search', async () => {
    const workflow = usePurchaseWorkflow()
    const offers = [
      {
        marketplace: 'Mercado Livre',
        title: 'Lanterna Traseira Direita Nissan Frontier 2003',
        price: 289.9,
        total: 289.9,
        totalPrice: 289.9,
        imageUrl: 'https://http2.mlstatic.com/frontier-a.jpg',
        url: 'https://produto.mercadolivre.com.br/MLB-123',
        compatibility_status: 'accepted',
        match_score: 1,
      },
      {
        marketplace: 'Shopee',
        title: 'Lanterna Direita Frontier 2003 2004',
        price: 315,
        total: 315,
        totalPrice: 315,
        imageUrl: 'https://cf.shopee.com.br/frontier-b.jpg',
        url: 'https://shopee.com.br/product/1/2',
        compatibility_status: 'accepted',
        match_score: 0.94,
      },
    ]
    fetchLiveMarketplaceOffers.mockResolvedValue({
      mode: 'live',
      status: 'found_compatible',
      offers,
      accepted_candidates: offers,
      best_compatible_offer: offers[0],
    })

    const result = await workflow.searchProductsByText('lanterna traseira direita frontier 2003')

    expect(result.results).toHaveLength(2)
    expect(result.results[0]).toMatchObject({
      name: 'Lanterna Traseira Direita Nissan Frontier 2003',
      value: 289.9,
      imageUrl: 'https://http2.mlstatic.com/frontier-a.jpg',
      marketplace: 'Mercado Livre',
      priceStatus: 'quoted',
    })
    expect(result.results[1]).toMatchObject({
      name: 'Lanterna Direita Frontier 2003 2004',
      value: 315,
      marketplace: 'Shopee',
    })
  })

  it('saves the selected marketplace result instead of falling back to the first result', async () => {
    const workflow = usePurchaseWorkflow()
    const store = useFinanceStore()
    const debugSpy = vi.spyOn(console, 'debug').mockImplementation(() => {})
    const offers = [
      {
        marketplace: 'Mercado Livre',
        title: 'Lanterna Traseira Direita Nissan Frontier 2003',
        price: 289.9,
        total: 289.9,
        totalPrice: 289.9,
        imageUrl: 'https://http2.mlstatic.com/frontier-a.jpg',
        url: 'https://produto.mercadolivre.com.br/MLB-123',
        compatibility_status: 'accepted',
        match_score: 1,
      },
      {
        marketplace: 'Shopee',
        title: 'Lanterna Direita Frontier 2003 2004',
        price: 315,
        total: 315,
        totalPrice: 315,
        imageUrl: 'https://cf.shopee.com.br/frontier-b.jpg',
        url: 'https://shopee.com.br/product/1/2',
        compatibility_status: 'accepted',
        match_score: 0.94,
      },
    ]
    fetchLiveMarketplaceOffers.mockResolvedValue({
      mode: 'live',
      status: 'found_compatible',
      offers,
      accepted_candidates: offers,
      best_compatible_offer: offers[0],
    })

    try {
      const search = await workflow.searchProductsByText('lanterna traseira direita frontier 2003')
      const saved = await workflow.saveIdentifiedProduct({
        ...search.results[1],
        category: 'Transporte',
        priority: 'Alta',
      })

      expect(saved).toMatchObject({
        name: 'Lanterna Direita Frontier 2003 2004',
        value: 315,
        marketplace: 'Shopee',
        imageUrl: 'https://cf.shopee.com.br/frontier-b.jpg',
        priceStatus: 'quoted',
      })
      expect(store.state.wishlist).toHaveLength(1)
      expect(store.state.wishlist[0]).toMatchObject({
        name: 'Lanterna Direita Frontier 2003 2004',
        value: 315,
        marketplace: 'Shopee',
      })
    } finally {
      debugSpy.mockRestore()
    }
  })

  it('does not promote cheaper ambiguous candidates above compatible results', async () => {
    const workflow = usePurchaseWorkflow()
    const store = useFinanceStore()
    const debugSpy = vi.spyOn(console, 'debug').mockImplementation(() => {})
    const accepted = {
      marketplace: 'Mercado Livre',
      title: 'Lanterna Traseira Direita Parachoque Fiat Punto 2010 2011 Internetpecas',
      price: 78.9,
      total: 78.9,
      totalPrice: 78.9,
      image: 'https://encrypted-tbn0.gstatic.com/shopping?q=accepted',
      url: '',
      compatibility_status: 'accepted',
      match_score: 1,
      match_reason: 'Contem lanterna traseira, lado direito e Punto.',
    }
    const ambiguous = {
      marketplace: 'Magalu',
      title: 'Lanterna Traseiro Fiat Punto 2007 a 2019 DPAULA DP3.370',
      price: 39.75,
      total: 39.75,
      compatibility_status: 'ambiguous',
      match_score: 0.43,
      match_reason: 'Candidato ambiguo ou incompleto para a identidade exigida.',
    }
    fetchLiveMarketplaceOffers.mockResolvedValue({
      mode: 'live',
      status: 'found_compatible',
      offers: [accepted],
      accepted_candidates: [accepted],
      ambiguous_candidates: [ambiguous],
      best_compatible_offer: accepted,
      product_identity: {
        product_type: 'auto_part',
        part_name: 'lanterna traseira',
        side: 'right',
        vehicle_make: 'Fiat',
        vehicle_model: 'Punto',
        vehicle_year: '2008',
        match_policy: 'strict',
      },
    })

    try {
      const search = await workflow.searchProductsByText('lanterna tras ld punto 2008')

      expect(search.results.map((item) => item.name)).toEqual([
        'Lanterna Traseira Direita Parachoque Fiat Punto 2010 2011 Internetpecas',
      ])

      const saved = await workflow.saveIdentifiedProduct({
        ...search.results[0],
        category: 'Transporte',
        priority: 'Alta',
      })

      expect(saved).toMatchObject({
        name: 'Lanterna Traseira Direita Parachoque Fiat Punto 2010 2011 Internetpecas',
        value: 78.9,
        imageUrl: 'https://encrypted-tbn0.gstatic.com/shopping?q=accepted',
        marketplace: 'Mercado Livre',
        priceStatus: 'quoted',
        price_search_status: 'found_compatible',
      })
      expect(store.state.wishlist[0]).toMatchObject({
        value: 78.9,
        lastQuotedPrice: 78.9,
        priceStatus: 'quoted',
      })
    } finally {
      debugSpy.mockRestore()
    }
  })

  it('keeps the selected item saved even when quote reconciliation fails', async () => {
    const workflow = usePurchaseWorkflow()
    const store = useFinanceStore()
    const debugSpy = vi.spyOn(console, 'debug').mockImplementation(() => {})
    const updateSpy = vi.spyOn(store, 'updateWishlistItem').mockImplementation(() => {
      throw new Error('quote update failed')
    })
    const offer = {
      marketplace: 'Shopee',
      title: 'Lanterna Direita Frontier 2003 2004',
      price: 315,
      total: 315,
      totalPrice: 315,
      imageUrl: 'https://cf.shopee.com.br/frontier-b.jpg',
      url: 'https://shopee.com.br/product/1/2',
      compatibility_status: 'accepted',
      match_score: 0.94,
    }

    try {
      const saved = await workflow.saveIdentifiedProduct({
        name: 'Lanterna Direita Frontier 2003 2004',
        description: 'lanterna traseira direita frontier 2003',
        category: 'Transporte',
        priority: 'Alta',
        value: 315,
        imageUrl: 'https://cf.shopee.com.br/frontier-b.jpg',
        marketplace: 'Shopee',
        liveResult: {
          mode: 'live',
          status: 'found_compatible',
          offers: [offer],
          accepted_candidates: [offer],
          best_compatible_offer: offer,
        },
      })

      expect(saved).toMatchObject({
        name: 'Lanterna Direita Frontier 2003 2004',
        value: 315,
        marketplace: 'Shopee',
      })
      expect(store.state.wishlist).toHaveLength(1)
      expect(store.state.wishlist[0]).toMatchObject({
        name: 'Lanterna Direita Frontier 2003 2004',
        value: 315,
      })
    } finally {
      debugSpy.mockRestore()
      updateSpy.mockRestore()
    }
  })

  it('does not schedule a background quote after saving without an immediate result', async () => {
    vi.useFakeTimers()
    try {
      const workflow = usePurchaseWorkflow()

      await workflow.saveIdentifiedProduct({
        name: 'Produto sem resultado imediato',
        description: 'Produto sem resultado imediato',
        category: 'Outros',
        priority: 'Media',
      })
      await vi.runAllTimersAsync()

      expect(fetchLiveMarketplaceOffers).not.toHaveBeenCalled()
    } finally {
      vi.useRealTimers()
    }
  })

  it('saves the item with the initial quote instead of leaving it pending in the list', async () => {
    const workflow = usePurchaseWorkflow()
    const store = useFinanceStore()
    const offer = {
      marketplace: 'Mercado Livre',
      title: 'Lanterna Traseira Direita Nissan Frontier 2003',
      price: 289.9,
      total: 289.9,
      totalPrice: 289.9,
      imageUrl: 'https://http2.mlstatic.com/frontier-lanterna.jpg',
      url: 'https://produto.mercadolivre.com.br/MLB-123-lanterna-frontier',
      compatibility_status: 'accepted',
      match_score: 1,
      match_reason: 'Contem lanterna traseira, lado direito e Frontier.',
    }

    const saved = await workflow.saveIdentifiedProduct({
      name: 'Lanterna Traseira Direita Nissan Frontier 2003',
      description: 'lanterna traseira direita frontier 2003',
      category: 'Transporte',
      priority: 'Alta',
      value: 289.9,
      imageUrl: 'https://http2.mlstatic.com/frontier-lanterna.jpg',
      marketplace: 'Mercado Livre',
      product_identity: {
        product_type: 'auto_part',
        part_name: 'lanterna traseira',
        side: 'right',
        vehicle_make: 'Nissan',
        vehicle_model: 'Frontier',
        match_policy: 'strict',
      },
      liveResult: {
        mode: 'live',
        status: 'found_compatible',
        offers: [offer],
        accepted_candidates: [offer],
        best_compatible_offer: offer,
      },
    })

    expect(saved).toMatchObject({
      priceStatus: 'quoted',
      price_search_status: 'found_compatible',
      value: 289.9,
      imageUrl: 'https://http2.mlstatic.com/frontier-lanterna.jpg',
    })
    expect(store.state.wishlist).toHaveLength(1)
    expect(store.state.wishlist[0].priceHistory).toHaveLength(1)
  })
})
