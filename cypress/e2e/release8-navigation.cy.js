const STORAGE_KEY = 'controle-financeiro-app-v2'
const scopedStorageKey = (userId = '88888888-8888-4888-8888-888888888888') => `${STORAGE_KEY}:${userId}`

function queryResult(data = null) {
  const result = { data, error: null }
  let chain
  chain = new Proxy({}, {
    get(_target, property) {
      if (property === 'then') return (resolve) => Promise.resolve(result).then(resolve)
      if (property === 'single' || property === 'maybeSingle') return () => Promise.resolve(result)
      return () => chain
    },
  })
  return chain
}

function installSupabaseStub(win) {
  const user = { id: '88888888-8888-4888-8888-888888888888', email: 'release8@example.com' }
  const session = { access_token: 'e2e-token', user }
  const channel = { on: () => channel, subscribe: () => channel }
  win.SUPABASE_CONFIG = { url: 'https://example.supabase.co', anonKey: 'e2e-anon' }
  win.supabase = {
    auth: {
      getSession: async () => ({ data: { session }, error: null }),
      getUser: async () => ({ data: { user }, error: null }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
    },
    from: () => queryResult(null),
    rpc: () => Promise.resolve({ data: null, error: null }),
    channel: () => channel,
    removeChannel: () => {},
    functions: {
      invoke: async (name) => {
        if (name === 'admin-current-user') return { data: { is_admin: false, role: 'user', permissions: [] }, error: null }
        if (name === 'entitlements-resolve') return {
          data: {
            plan_code: 'premium_monthly',
            is_tester: false,
            features: { scenario_simulation: true, predictive_advisor: true, smart_actions: true, automations: true, price_search: true },
            limits: { price_search_monthly: 50, automations_active: 10 },
          },
          error: null,
        }
        return { data: null, error: null }
      },
    },
  }
}

function release8State() {
  return {
    settings: { year: 2026, selectedMonth: 6, currentMemberId: 'member-1' },
    family: { id: 'family-8' },
    familyMembers: [{ id: 'member-1', name: 'Usuario Release 8', role: 'administrator' }],
    financialAccounts: [{ id: 'account-1', name: 'Conta', type: 'Conta Corrente', balance: 5000 }],
    creditCards: [],
    benefitWallets: [],
    incomes: [{ id: 'income-1', date: '2026-06-05', type: 'Salario', amount: 5000 }],
    expenses: [],
    wishlist: [],
    planningGoals: [],
    categoryBudgets: [],
    internalTransfers: [],
  }
}

function visitApp(path, state = release8State()) {
  cy.visit(path, {
    onBeforeLoad(win) {
      installSupabaseStub(win)
      win.localStorage.setItem(scopedStorageKey(), JSON.stringify(state))
    },
  })
}

function clickMenuHref(href) {
  cy.get('.nav-toggle').click()
  cy.get(`[data-testid="app-sidebar"] a[href="${href}"]`).click({ force: true })
}

describe('Release 8 navigation core', () => {
  it('clicks primary menu items and opens canonical routes', () => {
    visitApp('/dashboard')

    clickMenuHref('/entries')
    cy.location('pathname').should('eq', '/entries')
    cy.get('[data-testid="entries-page"]').should('exist')

    clickMenuHref('/structure?tab=accounts')
    cy.location('pathname').should('eq', '/structure')
    cy.location('search').should('eq', '?tab=accounts')

    clickMenuHref('/purchases')
    cy.location('pathname').should('eq', '/purchases')
    cy.get('[data-testid="wishlist-add-link"], [data-testid="wishlist-add-disabled"]').should('exist')
  })

  it('reloads direct planning and legacy decision URLs without NotFound or blank state', () => {
    for (const [path, text] of [
      ['/plan', 'Planejamento'],
      ['/purchases', 'Wishlist'],
      ['/simulations/can-i-buy', 'Posso comprar?'],
    ]) {
      visitApp(path)
      cy.contains(text).should('exist')
      cy.contains('Pagina nao encontrada').should('not.exist')
    }
  })

  it('keeps the mobile menu functional at 390px', () => {
    cy.viewport(390, 844)
    visitApp('/dashboard')
    cy.get('[data-testid="mobile-more-button"]').click()
    cy.get('[data-testid="mobile-more-drawer"] a[href="/purchases"]').click({ force: true })
    cy.location('pathname').should('eq', '/purchases')
    cy.window().then((win) => {
      expect(win.document.documentElement.scrollWidth).to.be.lte(win.innerWidth + 1)
    })
  })
})
