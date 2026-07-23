import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import fs from 'node:fs'
import PurchaseWishlist from '@/views/PurchaseWishlist.vue'
import { useFinanceStore } from '@/stores/finance.js'

vi.mock('@/composables/usePlanAccess', () => ({
  usePlanAccess: () => ({
    access: { value: { features: { wishlist_items: true }, limits: { wishlist_items: null } } },
    canUse: () => true,
  }),
}))

vi.mock('@/stores/family-sync.js', () => ({
  useFamilySyncStore: () => ({ applyingRemote: false, schedulePush: vi.fn() }),
}))

function mountPage(pinia) {
  return mount(PurchaseWishlist, {
    global: {
      plugins: [pinia],
      stubs: {
        ContextualAssistant: true,
        EmptyState: true,
        RouterLink: { props: ['to'], template: '<a :href="to"><slot /></a>' },
      },
    },
  })
}

describe('wishlist purchase link', () => {
  beforeEach(() => {
    const pinia = createPinia()
    setActivePinia(pinia)
    localStorage.clear()
    vi.clearAllMocks()
  })

  it('shows the direct product link when the saved item has one', () => {
    const pinia = createPinia()
    setActivePinia(pinia)
    const store = useFinanceStore()
    store.setActiveUser('user-a')
    store.addWishlistItem({
      name: 'PlayStation 5',
      value: 3500,
      marketplace: 'Loja Exemplo',
      priceStatus: 'quoted',
      priceMode: 'live',
      originalUrl: 'https://loja.example/produto/ps5',
    })

    const wrapper = mountPage(pinia)
    const link = wrapper.get('[data-testid="wishlist-buy-link"]')

    expect(link.attributes('href')).toBe('https://loja.example/produto/ps5')
    expect(link.attributes('target')).toBe('_blank')
    expect(link.text()).toContain('Comprar')
  })

  it('shows a shopping search fallback when the provider did not return a direct URL', () => {
    const pinia = createPinia()
    setActivePinia(pinia)
    const store = useFinanceStore()
    store.setActiveUser('user-a')
    store.addWishlistItem({
      name: 'Lanterna traseira Frontier 2003',
      priceStatus: 'pending_quote',
      priceMode: 'pending_quote',
    })

    const wrapper = mountPage(pinia)
    const link = wrapper.get('[data-testid="wishlist-buy-link"]')

    expect(link.attributes('href')).toBe('https://www.google.com/search?tbm=shop&q=Lanterna%20traseira%20Frontier%202003')
    expect(link.text()).toContain('Buscar oferta')
  })

  it('points the buy button to the current ad URL when a compatible offer exists', () => {
    const pinia = createPinia()
    setActivePinia(pinia)
    const store = useFinanceStore()
    store.setActiveUser('user-a')
    store.addWishlistItem({
      name: 'Lanterna Frontier 2003',
      value: 289.9,
      marketplace: 'Mercado Livre',
      priceStatus: 'quoted',
      priceMode: 'live',
      originalUrl: 'https://www.mercadolivre.com.br/p/MLB123456',
      canonicalUrl: 'https://www.mercadolivre.com.br/p/MLB123456',
      best_compatible_offer: {
        url: 'https://produto.mercadolivre.com.br/MLB-987654-lanterna-frontier-_JM',
        total: 289.9,
        compatibility_status: 'accepted',
        match_score: 1,
      },
    })

    const wrapper = mountPage(pinia)
    const link = wrapper.get('[data-testid="wishlist-buy-link"]')

    expect(link.attributes('href')).toBe('https://produto.mercadolivre.com.br/MLB-987654-lanterna-frontier-_JM')
  })

  it('shows a contextual buy button when the financial decision identifies a good offer', () => {
    const pinia = createPinia()
    setActivePinia(pinia)
    const store = useFinanceStore()
    store.setActiveUser('user-a')
    store.state.settings.year = 2026
    store.state.settings.selectedMonth = 6
    store.state.settings.emergencyReserveCurrent = 10000
    store.state.settings.emergencyReserveMinimum = 1000
    store.state.settings.monthlyRecurringExpenses = 100
    store.state.settings.cardLimit = 10000
    store.addIncome({
      date: '2026-06-05',
      type: 'Salario',
      amount: 10000,
      description: 'Salario',
    })
    store.addWishlistItem({
      name: 'Lanterna Frontier 2003',
      value: 100,
      marketplace: 'Mercado Livre',
      priceStatus: 'quoted',
      priceMode: 'live',
      originalUrl: 'https://www.mercadolivre.com.br/p/MLB123456',
      best_compatible_offer: {
        url: 'https://produto.mercadolivre.com.br/MLB-987654-lanterna-frontier-_JM',
        total: 100,
        compatibility_status: 'accepted',
        match_score: 1,
      },
    })

    const wrapper = mountPage(pinia)
    const callout = wrapper.get('[data-testid="wishlist-good-offer"]')
    const link = wrapper.get('[data-testid="wishlist-good-offer-buy-link"]')

    expect(callout.text()).toContain('Oferta boa')
    expect(link.attributes('href')).toBe('https://produto.mercadolivre.com.br/MLB-987654-lanterna-frontier-_JM')
    expect(link.text()).toContain('Comprar item')
  })

  it('shows a buy button in the ranking and decision panel for the selected item', async () => {
    const pinia = createPinia()
    setActivePinia(pinia)
    const store = useFinanceStore()
    store.setActiveUser('user-a')
    store.addWishlistItem({
      name: 'PlayStation 5',
      value: 3500,
      marketplace: 'Loja Exemplo',
      priceStatus: 'quoted',
      priceMode: 'live',
      originalUrl: 'https://loja.example/produto/ps5',
    })

    const wrapper = mountPage(pinia)

    const rankingLink = wrapper.get('[data-testid="wishlist-ranking-buy-link"]')
    expect(rankingLink.attributes('href')).toBe('https://loja.example/produto/ps5')
    expect(rankingLink.text()).toContain('Comprar item')

    const simulateButton = wrapper.findAll('button')
      .find((button) => button.text().includes('Simular Compra'))
    expect(simulateButton).toBeTruthy()
    await simulateButton.trigger('click')

    const decisionLink = wrapper.get('[data-testid="wishlist-decision-buy-link"]')
    expect(decisionLink.attributes('href')).toBe('https://loja.example/produto/ps5')
    expect(decisionLink.text()).toContain('Comprar item')
  })

  it('uses the app confirmation modal for destructive wishlist deletion', () => {
    const source = fs.readFileSync('src/views/PurchaseWishlist.vue', 'utf8')

    expect(source).toContain('ConfirmModal')
    expect(source).toContain('confirmDeleteItem')
    expect(source).not.toContain('window.confirm')
  })
})
