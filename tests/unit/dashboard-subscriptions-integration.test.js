import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import Home from '@/views/Home.vue'
import { useFinanceStore } from '@/stores/finance.js'

const routerPush = vi.fn()

vi.mock('vue-router', () => ({
  useRoute: () => ({ query: {} }),
  useRouter: () => ({ push: routerPush }),
}))

vi.mock('@/stores/family-sync.js', () => ({
  useFamilySyncStore: () => ({ applyingRemote: false, schedulePush: vi.fn() }),
}))

vi.mock('@/composables/useNotification', () => ({
  useNotification: () => ({ showToast: vi.fn() }),
}))

function mountHome(seed = {}, options = {}) {
  const pinia = createPinia()
  setActivePinia(pinia)
  const store = useFinanceStore()
  store.setActiveUser('dashboard-subscriptions-user')
  Object.assign(store.state, {
    settings: {
      ...store.state.settings,
      year: 2026,
      selectedMonth: 7,
      hideBalance: false,
      emergencyReserveCurrent: 0,
      emergencyReserveMinimum: 0,
    },
    incomes: [{
      id: 'income-1',
      date: '2026-07-05',
      type: 'Salário',
      amount: 3000,
      sourceType: 'account',
      sourceId: 'acc-1',
    }],
    expenses: [{
      id: 'expense-1',
      date: '2026-07-08',
      category: 'Mercado',
      description: 'Supermercado',
      payment: 'Pix',
      amount: 100,
      paid: true,
      sourceType: 'account',
      sourceId: 'acc-1',
    }],
    financialAccounts: [{ id: 'acc-1', name: 'Conta', balance: 1000 }],
    creditCards: [{ id: 'card-1', name: 'Visa', limit: 2000, availableLimit: 2000 }],
    benefitWallets: [],
    subscriptions: [{
      id: 'netflix',
      name: 'Netflix',
      provider: 'Netflix',
      category: 'Streaming',
      amount: 30,
      billing_cycle: 'monthly',
      billing_interval: 1,
      next_billing_date: '2026-07-20',
      status: 'active',
      payment_method_type: 'card',
      card_id: 'card-1',
      reminder_days: 3,
      is_essential: false,
    }],
    subscriptionCharges: [],
    planningGoals: [],
    wishlist: [],
    priceMonitorAlerts: [],
    recurringRules: [],
    ...seed,
  })

  const wrapper = mount(Home, {
    global: {
      plugins: [pinia],
      stubs: {
        ContextualAssistant: true,
        DemoModeDashboard: true,
        EmptyState: true,
        ExecutiveHero: options.executiveHeroStub || { template: '<section data-testid="executive-hero-stub" />' },
        DashboardGrid: {
          template: `
            <section data-testid="dashboard-grid-stub">
              <div><slot name="main" /></div>
              <aside><slot name="aside" /></aside>
            </section>
          `,
        },
      },
    },
  })

  return { wrapper, store }
}

describe('dashboard subscription integration', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-09T15:00:00.000Z'))
    localStorage.clear()
    routerPush.mockClear()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('includes unpaid subscription forecasts in dashboard expense cards and categories', () => {
    const { wrapper } = mountHome()

    const kpis = wrapper.get('[data-dashboard-section="dashboard-kpis"]').text().replace(/\s+/g, ' ')
    const categories = wrapper.get('[data-dashboard-section="category-summary"]').text().replace(/\s+/g, ' ')

    expect(kpis).toMatch(/Despesas\s*R\$ 130,00/)
    expect(categories).toContain('Assinaturas')
    expect(categories).toContain('23%')
    expect(wrapper.text().replace(/\s+/g, ' ')).toContain('R$ 30,00 em assinaturas este mês')
  })

  it('gives the balance coverage metric enough context', () => {
    const { wrapper } = mountHome()

    const brief = wrapper.get('[data-dashboard-section="financial-brief"]').text().replace(/\s+/g, ' ')

    expect(brief).toContain('Cobertura do saldo')
    expect(brief).toContain('22,1x dos gastos')
    expect(brief).not.toContain('Cobertura 22,1x')
    expect(brief).not.toContain('Cobertura 0,0x')
  })

  it('turns empty dashboard sections into actionable states', async () => {
    const { wrapper } = mountHome({
      expenses: [],
      subscriptions: [],
      recurringRules: [{ id: 'planned-expense' }],
      planningGoals: [],
    })

    const categories = wrapper.get('[data-dashboard-section="category-summary"]')
    expect(categories.text()).toContain('Registre uma despesa para ativar categorias e análises do período.')
    expect(categories.text()).not.toContain('Sem despesas no período.')

    await categories.get('[data-testid="simulate-expenses-action"]').trigger('click')
    expect(routerPush).toHaveBeenCalledWith('/simulations')

    const goals = wrapper.get('[data-dashboard-section="goals-summary"]')
    expect(goals.text()).toContain('+ Criar minha primeira meta')

    await goals.get('[data-testid="create-first-goal-action"]').trigger('click')
    expect(routerPush).toHaveBeenCalledWith('/goals')
  })

  it('starts with a simplified dashboard and first-income wizard before minimum data exists', async () => {
    const { wrapper } = mountHome({
      incomes: [],
      expenses: [],
      financialAccounts: [],
      creditCards: [],
      subscriptions: [],
      recurringRules: [],
      planningGoals: [],
      wishlist: [],
    })

    const initial = wrapper.get('[data-testid="initial-dashboard"]')
    expect(initial.text()).toContain('Receitas')
    expect(initial.text()).toContain('Despesas')
    expect(initial.text()).toContain('Saldo')
    expect(wrapper.find('[data-dashboard-section="financial-brief"]').exists()).toBe(false)
    expect(wrapper.find('[data-dashboard-section="advisor-summary"]').exists()).toBe(false)

    await initial.get('[data-testid="open-first-income-wizard"]').trigger('click')

    const modal = wrapper.get('[data-testid="first-income-modal"]')
    expect(modal.attributes('role')).toBe('dialog')
    expect(modal.text()).toContain('Cadastrar primeira receita')
  })

  it('hides empty KPI cards and keeps only relevant metrics once there is partial data', () => {
    const { wrapper } = mountHome({
      expenses: [],
      subscriptions: [],
      recurringRules: [{ id: 'planned-expense' }],
      planningGoals: [],
    })

    const kpis = wrapper.get('[data-dashboard-section="dashboard-kpis"]').text().replace(/\s+/g, ' ')

    expect(kpis).toContain('Receitas')
    expect(kpis).toContain('Saldo')
    expect(kpis).not.toContain('Despesas R$ 0,00')
    expect(kpis).not.toContain('Cobertura 0,0x')
  })

  it('uses suggested quick-entry categories instead of an empty select placeholder', async () => {
    const { wrapper } = mountHome()

    const categorySelect = wrapper.get('[data-testid="quick-entry-category"]')
    expect(categorySelect.text()).not.toContain('Selecione')
    expect(categorySelect.element.value).toBe('Mercado')

    await wrapper.get('[data-testid="quick-entry-type-income"]').trigger('click')

    expect(wrapper.get('[data-testid="quick-entry-category"]').element.value).toBe('Salário')
  })

  it('uses first steps mode to guide income entry when income is missing', async () => {
    const { wrapper } = mountHome({
      incomes: [],
      financialAccounts: [{ id: 'acc-1', name: 'Conta', balance: 1000 }],
      expenses: [{
        id: 'expense-1',
        date: '2026-07-08',
        category: 'Mercado',
        description: 'Supermercado',
        payment: 'Pix',
        amount: 100,
        paid: true,
        sourceType: 'account',
        sourceId: 'acc-1',
      }],
    })

    expect(wrapper.get('[data-testid="first-steps-mode"]').exists()).toBe(true)
    expect(wrapper.get('[data-first-step-section="income"]').text()).toContain('Complete sua primeira receita para ativar análises')

    await wrapper.get('[data-first-step-section="income"] button').trigger('click')

    expect(routerPush).toHaveBeenCalledWith('/entries')
  })
})
