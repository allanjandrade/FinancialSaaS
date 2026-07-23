import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import PurchaseNew from '@/views/PurchaseNew.vue'

const mocks = vi.hoisted(() => ({
  routerPush: vi.fn(),
  showToast: vi.fn(),
  searchProductsByText: vi.fn(),
  saveIdentifiedProduct: vi.fn(),
  addProductFromUrl: vi.fn(),
  identifyFromImage: vi.fn(),
  identifyFromText: vi.fn(),
}))

vi.mock('vue-router', () => ({
  useRoute: () => ({ query: {} }),
  useRouter: () => ({ push: mocks.routerPush }),
}))

vi.mock('@/composables/useNotification', () => ({
  useNotification: () => ({ showToast: mocks.showToast }),
}))

vi.mock('@/composables/usePurchaseWorkflow.js', () => ({
  usePurchaseWorkflow: () => ({
    searchProductsByText: mocks.searchProductsByText,
    saveIdentifiedProduct: mocks.saveIdentifiedProduct,
    addProductFromUrl: mocks.addProductFromUrl,
    identifyFromImage: mocks.identifyFromImage,
    identifyFromText: mocks.identifyFromText,
  }),
}))

const product = {
  name: 'Lanterna Direita Frontier 2003',
  value: 315,
  marketplace: 'Shopee',
  imageUrl: 'https://cf.shopee.com.br/frontier-b.jpg',
  originalLink: 'https://shopee.com.br/product/1/2',
  source: 'description',
  liveResult: {
    mode: 'live',
    status: 'found_compatible',
    offers: [],
  },
}

function mountPage() {
  return mount(PurchaseNew, {
    global: {
      stubs: {
        RouterLink: { template: '<a><slot /></a>' },
      },
    },
  })
}

describe('PurchaseNew result saving', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.searchProductsByText.mockResolvedValue({ results: [product] })
    mocks.saveIdentifiedProduct.mockResolvedValue({ ...product, priceStatus: 'quoted' })
  })

  it('saves a result directly when the user clicks the result card save button', async () => {
    const wrapper = mountPage()

    await wrapper.find('textarea').setValue('lanterna frontier 2003')
    await flushPromises()
    await wrapper.find('.result-card button').trigger('click')
    await flushPromises()

    expect(mocks.saveIdentifiedProduct).toHaveBeenCalledWith(expect.objectContaining({
      name: 'Lanterna Direita Frontier 2003',
      value: 315,
      marketplace: 'Shopee',
    }))
    expect(mocks.routerPush).toHaveBeenCalledWith('/purchases')
  })

  it('saves the best visible result when the user clicks the main action with results loaded', async () => {
    const wrapper = mountPage()

    await wrapper.find('textarea').setValue('lanterna frontier 2003')
    await flushPromises()
    await wrapper.find('form.conversation-card').trigger('submit')
    await flushPromises()

    expect(mocks.saveIdentifiedProduct).toHaveBeenCalledWith(expect.objectContaining({
      name: 'Lanterna Direita Frontier 2003',
      value: 315,
      marketplace: 'Shopee',
    }))
    expect(mocks.routerPush).toHaveBeenCalledWith('/purchases')
  })

  it('shows a buy button for each visible marketplace result', async () => {
    const wrapper = mountPage()

    await wrapper.find('textarea').setValue('lanterna frontier 2003')
    await flushPromises()

    const link = wrapper.get('[data-testid="purchase-result-buy-link"]')
    expect(link.attributes('href')).toBe('https://shopee.com.br/product/1/2')
    expect(link.attributes('target')).toBe('_blank')
    expect(link.text()).toContain('Comprar item')
  })
})
