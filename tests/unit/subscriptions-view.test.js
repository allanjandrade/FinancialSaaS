import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import Subscriptions from '@/views/Subscriptions.vue'
import { useFinanceStore } from '@/stores/finance.js'

vi.mock('@/stores/family-sync.js', () => ({
  useFamilySyncStore: () => ({ applyingRemote: false, schedulePush: vi.fn() }),
}))

vi.mock('@/composables/useNotification', () => ({
  useNotification: () => ({ showToast: vi.fn() }),
}))

function mountSubscriptions(seed = {}) {
  const pinia = createPinia()
  setActivePinia(pinia)
  const store = useFinanceStore()
  store.setActiveUser('subscriptions-view-user')
  Object.assign(store.state, {
    subscriptions: [],
    subscriptionCharges: [],
    creditCards: [],
    financialAccounts: [],
    benefitWallets: [],
    ...seed,
  })

  const wrapper = mount(Subscriptions, {
    global: {
      plugins: [pinia],
      stubs: {
        PageShell: {
          template: `
            <main data-testid="subscriptions-page">
              <header><slot name="actions" /></header>
              <slot />
            </main>
          `,
        },
      },
    },
    attachTo: document.body,
  })

  return { wrapper, store }
}

describe('Subscriptions view UX', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-09T15:00:00.000Z'))
    localStorage.clear()
    document.body.innerHTML = ''
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('keeps the create form hidden until the user starts a new subscription', async () => {
    const { wrapper } = mountSubscriptions()

    expect(wrapper.find('[data-testid="subscription-form-drawer"]').exists()).toBe(false)
    expect(wrapper.text()).toContain('Netflix ou o Spotify')
    expect(wrapper.text()).toContain('Cadastrar Minha Primeira Assinatura')
    expect(wrapper.text()).not.toContain('Todos status')

    await wrapper.get('[data-testid="empty-subscription-create"]').trigger('click')

    expect(wrapper.get('[data-testid="subscription-form-drawer"]').text()).toContain('Cadastro de assinatura')
  })

  it('suggests provider and category while typing a known service', async () => {
    const { wrapper } = mountSubscriptions()

    await wrapper.get('[data-testid="top-subscription-create"]').trigger('click')
    await wrapper.get('[data-testid="subscription-name-input"]').setValue('Netflix')
    await wrapper.vm.$nextTick()

    expect(wrapper.get('[data-testid="subscription-provider-input"]').element.value).toBe('Netflix')
    expect(wrapper.get('[data-testid="subscription-category-select"]').element.value).toBe('Streaming')
    expect(wrapper.get('[data-testid="subscription-service-suggestion"]').text()).toContain('Netflix')
  })

  it('uses a generic benefit payment source without exposing wallet ids', async () => {
    const { wrapper, store } = mountSubscriptions({
      benefitWallets: [{ id: 'benefit-meal', name: 'Vale refeicao' }],
    })

    await wrapper.get('[data-testid="top-subscription-create"]').trigger('click')

    const sourceSelect = wrapper.findAll('select')
      .find((select) => select.find('option[value="other:"]').exists())
    const optionValues = sourceSelect.findAll('option').map((option) => option.attributes('value'))

    expect(optionValues).toContain('benefit:')
    expect(optionValues).not.toContain('benefit:benefit-meal')

    await wrapper.get('[data-testid="subscription-name-input"]').setValue('Gympass')
    await sourceSelect.setValue('benefit:')
    await wrapper.get('form.subscription-form').trigger('submit')

    expect(store.state.subscriptions[0]).toMatchObject({
      payment_method_type: 'benefit',
      card_id: null,
      account_id: null,
    })
    expect(store.state.subscriptions[0]).not.toHaveProperty('benefit_id')
  })

  it('uses the next active subscription even when it is outside the 30 day alert window', () => {
    const { wrapper } = mountSubscriptions({
      subscriptions: [
        {
          id: 'netflix',
          name: 'Netflix',
          provider: 'Netflix',
          category: 'Streaming',
          amount: 30,
          billing_cycle: 'monthly',
          billing_interval: 1,
          next_billing_date: '2026-08-09',
          status: 'active',
          payment_method_type: 'card',
          card_id: 'card-1',
          reminder_days: 3,
          is_essential: false,
        },
      ],
      creditCards: [{ id: 'card-1', name: 'Visa' }],
    })

    const nextChargeCard = wrapper.get('[data-testid="next-charge-card"]')

    expect(nextChargeCard.text()).toContain('R$ 30,00 em 09/08')
    expect(nextChargeCard.text()).toContain('Netflix')
    expect(nextChargeCard.text()).toContain('Em 1 mês')
    expect(nextChargeCard.text()).not.toContain('Sem cobran')
  })

  it('uses a two column desktop layout with impact and alerts in the side column', () => {
    const { wrapper } = mountSubscriptions({
      subscriptions: [
        {
          id: 'sub-card',
          name: 'Netflix',
          provider: 'Netflix',
          category: 'Streaming',
          amount: 39.9,
          billing_cycle: 'monthly',
          billing_interval: 1,
          next_billing_date: '2026-07-09',
          status: 'active',
          payment_method_type: 'card',
          card_id: 'card-1',
          reminder_days: 3,
          is_essential: false,
        },
        {
          id: 'sub-account',
          name: 'iCloud',
          provider: 'Apple',
          category: 'Casa',
          amount: 14.9,
          billing_cycle: 'monthly',
          billing_interval: 1,
          next_billing_date: '2026-07-09',
          status: 'active',
          payment_method_type: 'account',
          account_id: 'acc-1',
          reminder_days: 3,
          is_essential: true,
        },
      ],
      creditCards: [{ id: 'card-1', name: 'Visa' }],
      financialAccounts: [{ id: 'acc-1', name: 'Conta' }],
    })

    const layout = wrapper.get('[data-testid="subscriptions-layout"]')

    expect(layout.find('.content-column .kpi-grid').exists()).toBe(true)
    expect(layout.find('.content-column .list-panel').exists()).toBe(true)
    expect(layout.find('.side-column .impact-panel').exists()).toBe(true)
    expect(layout.find('.side-column .alerts-panel').exists()).toBe(true)
    expect(layout.find('[data-testid="impact-card-bar"]').exists()).toBe(true)
    expect(layout.find('[data-testid="impact-account-bar"]').exists()).toBe(true)
  })

  it('keeps subscription cards compact and hides critical actions inside a menu', async () => {
    const { wrapper } = mountSubscriptions({
      subscriptions: [
        {
          id: 'netflix',
          name: 'Netflix',
          provider: 'Netflix',
          category: 'Streaming',
          amount: 30,
          billing_cycle: 'monthly',
          billing_interval: 1,
          next_billing_date: '2026-08-09',
          status: 'active',
          payment_method_type: 'card',
          card_id: 'card-1',
          reminder_days: 3,
          is_essential: false,
        },
      ],
      creditCards: [{ id: 'card-1', name: 'Visa' }],
    })

    const row = wrapper.get('[data-testid="subscription-card-netflix"]')

    expect((row.text().match(/R\$ 30,00/g) || []).length).toBe(1)
    expect(row.get('.status-badge').classes()).toContain('status-active')
    expect(row.text()).not.toContain('Editar')
    expect(row.text()).not.toContain('Pausar')
    expect(row.text()).not.toContain('Cancelar')
    expect(row.text()).not.toContain('Excluir')

    await row.get('[data-testid="subscription-action-menu"]').trigger('click')

    const menu = row.get('[data-testid="subscription-action-menu-content"]')
    expect(menu.text()).toContain('Editar')
    expect(menu.text()).toContain('Pausar')
    expect(menu.text()).toContain('Cancelar')
    expect(menu.text()).toContain('Excluir')
  })

  it('shows a branded service logo and a cancellation link for known subscriptions', async () => {
    const { wrapper } = mountSubscriptions({
      subscriptions: [
        {
          id: 'netflix',
          name: 'Netflix',
          provider: 'Netflix',
          category: 'Streaming',
          amount: 30,
          billing_cycle: 'monthly',
          billing_interval: 1,
          next_billing_date: '2026-08-09',
          status: 'active',
          payment_method_type: 'card',
          card_id: 'card-1',
          reminder_days: 3,
          is_essential: false,
        },
      ],
      creditCards: [{ id: 'card-1', name: 'Visa' }],
    })

    const row = wrapper.get('[data-testid="subscription-card-netflix"]')
    const logo = row.get('[data-testid="subscription-service-logo"]')

    expect(logo.attributes('aria-label')).toBe('Logo Netflix')
    expect(logo.text()).toBe('N')

    await row.get('[data-testid="subscription-action-menu"]').trigger('click')

    const cancelLink = row.get('[data-testid="subscription-cancel-link"]')
    expect(cancelLink.attributes('href')).toBe('https://www.netflix.com/cancelplan')
    expect(cancelLink.attributes('target')).toBe('_blank')
    expect(cancelLink.text()).toContain('Abrir cancelamento')
  })
})
