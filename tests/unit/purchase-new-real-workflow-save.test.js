import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import PurchaseNew from '@/views/PurchaseNew.vue'
import { useFinanceStore } from '@/stores/finance.js'
import { fetchLiveMarketplaceOffers } from '@/utils/marketplace-prices-api.js'

const routeMocks = vi.hoisted(() => ({
  routerPush: vi.fn(),
  showToast: vi.fn(),
}))

vi.mock('vue-router', () => ({
  useRoute: () => ({ query: {} }),
  useRouter: () => ({ push: routeMocks.routerPush }),
}))

vi.mock('@/composables/useNotification', () => ({
  useNotification: () => ({ showToast: routeMocks.showToast }),
}))

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

function mountPage(pinia) {
  return mount(PurchaseNew, {
    global: {
      plugins: [pinia],
      stubs: {
        RouterLink: { template: '<a><slot /></a>' },
      },
    },
  })
}

describe('PurchaseNew real workflow save', () => {
  beforeEach(() => {
    const pinia = createPinia()
    setActivePinia(pinia)
    localStorage.clear()
    vi.clearAllMocks()
    fetchLiveMarketplaceOffers.mockReset()
    window.supabase = {
      auth: {
        getUser: vi.fn(async () => ({ data: { user: { id: 'user-a' } }, error: null })),
        getSession: vi.fn(async () => ({ data: { session: { access_token: 'token-a' } }, error: null })),
      },
    }
  })

  it('persists the selected visible marketplace result in the real finance store', async () => {
    const pinia = createPinia()
    setActivePinia(pinia)
    const store = useFinanceStore()
    const debugSpy = vi.spyOn(console, 'debug').mockImplementation(() => {})
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
    fetchLiveMarketplaceOffers.mockResolvedValue({
      mode: 'live',
      status: 'found_compatible',
      offers: [offer],
      accepted_candidates: [offer],
      best_compatible_offer: offer,
    })

    try {
      const wrapper = mountPage(pinia)
      await wrapper.find('textarea').setValue('lanterna traseira direita frontier 2003')
      await flushPromises()
      await wrapper.find('.result-card button').trigger('click')
      await flushPromises()

      expect(store.state.wishlist).toHaveLength(1)
      expect(store.state.wishlist[0]).toMatchObject({
        name: 'Lanterna Direita Frontier 2003 2004',
        value: 315,
        marketplace: 'Shopee',
        priceStatus: 'quoted',
      })
      expect(JSON.parse(localStorage.getItem(store.getStorageKey())).wishlist).toHaveLength(1)
      expect(routeMocks.routerPush).toHaveBeenCalledWith('/purchases')
    } finally {
      debugSpy.mockRestore()
    }
  })
})
