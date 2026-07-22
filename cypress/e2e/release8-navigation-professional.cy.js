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

function state() {
  return {
    settings: { year: 2026, selectedMonth: 6, currentMemberId: 'member-1' },
    familyMembers: [{ id: 'member-1', name: 'Usuario Release 8.3', role: 'administrator' }],
    financialAccounts: [{ id: 'account-1', name: 'Conta', type: 'Conta Corrente', balance: 5000 }],
    creditCards: [{ id: 'card-1', name: 'Cartao', limit: 8000, availableLimit: 7600, closingDay: 20, dueDay: 8 }],
    benefitWallets: [],
    incomes: [{ id: 'i1', date: '2026-06-05', type: 'Salario', amount: 5200 }],
    expenses: [{ id: 'e1', date: '2026-06-10', category: 'Mercado', payment: 'Pix', amount: 760 }],
    wishlist: [{
      id: 'wish-nav',
      name: 'Produto Release 8.3',
      category: 'Outros',
      priority: 'Media',
      priceStatus: 'pending_quote',
      price_search_status: 'not_found',
      priceHistory: [],
      marketplaceOffers: [],
    }],
  }
}

function installSupabaseStub(win) {
  const user = { id: '88888888-8888-4888-8888-888888888888', email: 'release83@example.com' }
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

function visitApp(path, viewport = [1366, 768]) {
  cy.viewport(viewport[0], viewport[1])
  cy.visit(path, {
    onBeforeLoad(win) {
      installSupabaseStub(win)
      win.localStorage.clear()
      win.localStorage.setItem(scopedStorageKey(), JSON.stringify(state()))
    },
  })
}

function expectNoOverflow() {
  cy.window().then((win) => {
    expect(win.document.documentElement.scrollWidth).to.be.lte(win.innerWidth + 1)
  })
}

describe('Release 8.3 professional navigation', () => {
  it('supports collapsed and expanded desktop sidebar with clear active state', () => {
    visitApp('/dashboard')

    cy.get('[data-testid="app-sidebar"]').should('be.visible').and('not.have.class', 'expanded')
    cy.get('aside[data-testid="app-sidebar"] nav a.nav-item[href="/dashboard"]')
      .first()
      .as('dashboardNavItem')
      .should('exist')
    cy.get('@dashboardNavItem').trigger('mouseenter')
    cy.get('.nav-tooltip').should(($tooltip) => {
      expect($tooltip.css('position')).to.eq('fixed')
      expect(Number($tooltip.css('z-index'))).to.be.greaterThan(1000)
      expect($tooltip.css('opacity')).to.eq('1')
    })
    cy.get('.nav-toggle').should('have.attr', 'aria-label', 'Expandir menu').click()
    cy.get('[data-testid="app-sidebar"]').should('have.class', 'expanded')
    cy.get('[data-testid="app-sidebar"] a[href="/plan"]').should('exist').click({ force: true })
    cy.location('pathname').should('eq', '/plan')
    cy.get('[data-testid="breadcrumb"]').should('contain.text', 'Planejamento')
    cy.get('[data-testid="app-sidebar"] a[href="/plan"]').should('have.class', 'active')
    cy.get('.nav-toggle').should('have.attr', 'aria-label', 'Recolher menu').click()
    cy.get('[data-testid="app-sidebar"]').should('not.have.class', 'expanded')
  })

  it('keeps decision destinations explicit and never falls into NotFound', () => {
    visitApp('/plan')
    cy.get('.nav-toggle').click()
    cy.get('[data-testid="app-sidebar"] a[href="/purchases"]').click({ force: true })
    cy.location('pathname').should('eq', '/purchases')
    cy.get('[data-testid="breadcrumb"]').should('contain.text', 'Wishlist')

    visitApp('/simulations/can-i-buy')
    cy.location('pathname').should('eq', '/simulations/can-i-buy')
    cy.get('[data-testid="breadcrumb"]').should('contain.text', 'Planejamento').and('contain.text', 'Posso comprar?')
    cy.contains('Produto nao encontrado').should('not.exist')
  })

  it('redirects legacy product route to canonical purchases route with breadcrumb context', () => {
    visitApp('/compras-ia/produto/wish-nav')

    cy.location('pathname').should('eq', '/purchases/wish-nav')
    cy.get('[data-testid="breadcrumb"]').should('contain.text', 'Wishlist').and('contain.text', 'Produto')
    cy.get('[data-testid="app-sidebar"] a[href="/purchases"]').should('have.class', 'active')
  })

  it('uses bottom navigation and drawer on mobile without horizontal overflow', () => {
    visitApp('/dashboard', [390, 844])

    cy.get('[data-testid="app-sidebar"]').should('not.be.visible')
    cy.get('[data-testid="mobile-bottom-nav"]').should('be.visible')
    cy.get('[data-testid="mobile-bottom-nav"] a[href="/dashboard"]').should('exist')
    cy.get('[data-testid="mobile-bottom-nav"] a[href="/plan"]').should('exist')
    cy.location('pathname').should('eq', '/dashboard')
    cy.get('[data-testid="mobile-more-button"]').should('be.visible').and('contain.text', 'Mais').click()
    cy.get('[data-testid="mobile-more-drawer"]').should('have.attr', 'data-open', 'true').and('have.class', 'open')
    cy.get('[data-testid="mobile-more-drawer"] a[href="/purchases"]').should('exist')
    cy.get('[data-testid="mobile-more-drawer"] a[href="/simulations"]').should('not.exist')
    cy.get('[data-testid="mobile-more-drawer"] a[href="/purchases"]').click({ force: true })
    cy.location('pathname').should('eq', '/purchases')
    cy.get('[data-testid="breadcrumb"]').should('contain.text', 'Wishlist')
    expectNoOverflow()
  })
})
