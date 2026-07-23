import fs from 'node:fs'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import CommandCenter from '@/views/CommandCenter.vue'
import { SOURCE_TYPES } from '@/constants/financial-structure.js'
import { useFinanceStore } from '@/stores/finance.js'

const routeMocks = vi.hoisted(() => ({
  routerPush: vi.fn(),
}))

vi.mock('vue-router', () => ({
  useRouter: () => ({ push: routeMocks.routerPush }),
}))

vi.mock('@/stores/family-sync.js', () => ({
  useFamilySyncStore: () => ({ applyingRemote: false, schedulePush: vi.fn() }),
}))

const read = (file) => fs.readFileSync(file, 'utf8')

function seedCommandCenterStore(seed = {}) {
  const pinia = createPinia()
  setActivePinia(pinia)
  const store = useFinanceStore()
  store.setActiveUser('v34-command-center-user')
  Object.assign(store.state, {
    settings: {
      ...store.state.settings,
      year: 2026,
      selectedMonth: 7,
      hideBalance: false,
      emergencyReserveCurrent: 0,
      emergencyReserveMinimum: 0,
    },
    incomes: [],
    expenses: [],
    financialAccounts: [{ id: 'account-1', name: 'Conta principal', type: 'Conta Corrente', balance: 0 }],
    creditCards: [],
    benefitWallets: [],
    subscriptions: [],
    subscriptionCharges: [],
    planningGoals: [],
    wishlist: [],
    priceMonitorAlerts: [],
    importSessions: [],
    pendingReviews: [],
    ...seed,
  })
  return { pinia, store }
}

function mountCommandCenter(seed = {}) {
  const { pinia, store } = seedCommandCenterStore(seed)
  const wrapper = mount(CommandCenter, {
    global: {
      plugins: [pinia],
      stubs: {
        RouterLink: { template: '<a><slot /></a>' },
        PageShell: {
          template: `
            <main data-testid="command-center-page">
              <header><slot name="actions" /></header>
              <slot />
            </main>
          `,
        },
        FinancialOSMap: true,
        AssistedActionDrawer: {
          name: 'AssistedActionDrawer',
          props: ['show', 'execution', 'submitting', 'error', 'successToken'],
          emits: ['close', 'confirm', 'route'],
          template: `
            <aside
              v-if="show && execution"
              data-testid="assisted-drawer-stub"
              :data-execution-type="execution.type"
            />
          `,
        },
      },
    },
    attachTo: document.body,
  })
  return { wrapper, store }
}

describe('V3.4 Command Center assisted execution integration', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-23T15:00:00.000Z'))
    localStorage.clear()
    document.body.innerHTML = ''
    routeMocks.routerPush.mockClear()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('wires the assisted action drawer contract into Command Center source', () => {
    const commandCenter = read('src/views/CommandCenter.vue')

    expect(commandCenter).toContain("import AssistedActionDrawer from '@/components/v3/AssistedActionDrawer.vue'")
    expect(commandCenter).toContain("import { buildAssistedExecution } from '@/domain/v3/actionExecution.js'")
    expect(commandCenter).toContain('const selectedAssistedAction = ref(null)')
    expect(commandCenter).toContain('<AssistedActionDrawer')
    expect(commandCenter).toContain('@confirm="confirmAssistedAction"')
    expect(commandCenter).toContain("execution.mode === 'drawer'")
  })

  it('opens first-income assisted execution without writing until confirm', async () => {
    const { wrapper, store } = mountCommandCenter()

    await wrapper.get('[data-testid="v33-next-best-action"] button.primary-button').trigger('click')
    await flushPromises()

    const drawer = wrapper.getComponent({ name: 'AssistedActionDrawer' })
    expect(drawer.props('show')).toBe(true)
    expect(drawer.props('execution')).toMatchObject({
      type: 'first-income',
      mode: 'drawer',
    })
    expect(store.state.incomes).toHaveLength(0)

    drawer.vm.$emit('confirm', {
      execution: drawer.props('execution'),
      draft: {
        description: 'Salario ACME',
        amount: 5000,
        date: '2026-07-05',
        type: 'Salario',
        sourceId: 'account-1',
      },
    })
    await flushPromises()

    expect(store.state.incomes).toHaveLength(1)
    expect(store.state.incomes[0]).toMatchObject({
      description: 'Salario ACME',
      amount: 5000,
      date: '2026-07-05',
      sourceType: SOURCE_TYPES.ACCOUNT,
      sourceId: 'account-1',
    })
  })

  it('routes assisted drawer fallback descriptors through Command Center router push', async () => {
    const { wrapper } = mountCommandCenter()

    await wrapper.get('[data-testid="v33-next-best-action"] button.primary-button').trigger('click')
    await flushPromises()

    wrapper.getComponent({ name: 'AssistedActionDrawer' }).vm.$emit('route', {
      route: '/entries',
      fallbackRoute: '/entries',
    })
    await flushPromises()

    expect(routeMocks.routerPush).toHaveBeenCalledWith('/entries')
  })
})
