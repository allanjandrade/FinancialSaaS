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
  const user = { id: '88888888-8888-4888-8888-888888888888', email: 'release82@example.com' }
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
    functions: { invoke: async () => ({ data: null, error: null }) },
  }
}

function dashboardState() {
  return {
    settings: { year: 2026, selectedMonth: 7, currentMemberId: 'member-1', cardClosingDay: 20 },
    family: { id: 'family-82' },
    familyMembers: [{ id: 'member-1', name: 'Usuario Release 8.2', role: 'administrator' }],
    financialAccounts: [{ id: 'account-1', name: 'Conta', type: 'Conta Corrente', balance: 6400 }],
    creditCards: [{ id: 'card-1', name: 'Cartao', limit: 9000, availableLimit: 6200, closingDay: 20, dueDay: 8 }],
    benefitWallets: [],
    incomes: [
      { id: 'i1', date: '2026-06-05', type: 'Salario', amount: 5000 },
      { id: 'i2', date: '2026-07-05', type: 'Salario', amount: 6200 },
    ],
    expenses: [
      { id: 'e1', date: '2026-07-06', category: 'Moradia', payment: 'Pix', amount: 1800, description: 'Aluguel' },
      { id: 'e2', date: '2026-07-10', category: 'Mercado', payment: 'Pix', amount: 760, description: 'Supermercado' },
      { id: 'e3', date: '2026-07-12', category: 'Assinaturas', payment: 'Credito', amount: 180, description: 'Streaming', cardCompetencyMonth: 7, cardCompetencyYear: 2026 },
      { id: 'e4', date: '2026-07-14', category: 'Transporte', payment: 'Pix', amount: 320, description: 'Combustivel' },
    ],
    planningGoals: [
      { id: 'g1', name: 'Reserva', target_amount: 12000, current_amount: 4200, monthly_contribution: 500, status: 'active' },
    ],
    categoryBudgets: [
      { id: 'b1', month_key: 202607, category: 'Mercado', planned: 900 },
      { id: 'b2', month_key: 202607, category: 'Transporte', planned: 500 },
    ],
    wishlist: [{ id: 'w1', name: 'Notebook', monitorPrice: true, priceStatus: 'pending_quote' }],
    priceMonitorAlerts: [{ id: 'a1', status: 'open', productName: 'Notebook', message: 'Preco caiu 8%.' }],
  }
}

function visitDashboard(width, height) {
  cy.viewport(width, height)
  cy.visit('/dashboard', {
    onBeforeLoad(win) {
      installSupabaseStub(win)
      win.localStorage.setItem(scopedStorageKey(), JSON.stringify(dashboardState()))
    },
  })
}

function expectNoOverflow() {
  cy.window().then((win) => {
    expect(win.document.documentElement.scrollWidth).to.be.lte(win.innerWidth + 1)
  })
}

function expectNoLargeVerticalGap() {
  cy.get('[data-dashboard-section]').then(($sections) => {
    const rects = [...$sections]
      .map((el) => {
        const rect = el.getBoundingClientRect()
        return {
          name: el.getAttribute('data-dashboard-section'),
          top: rect.top + window.scrollY,
          bottom: rect.bottom + window.scrollY,
          height: rect.height,
        }
      })
      .filter((rect) => rect.height > 20)
      .sort((a, b) => a.top - b.top)

    let coveredBottom = rects[0]?.bottom || 0
    for (const rect of rects.slice(1)) {
      const gap = rect.top - coveredBottom
      expect(gap, `gap before ${rect.name}`).to.be.lte(240)
      coveredBottom = Math.max(coveredBottom, rect.bottom)
    }
  })
}

function expectDesktopColumnsBalanced() {
  cy.get('[data-testid="dashboard-main"]').then(($grid) => {
    const main = $grid[0].querySelector('.dashboard-grid__main')
    const aside = $grid[0].querySelector('.dashboard-grid__aside')
    const mainBottom = main.getBoundingClientRect().bottom + window.scrollY
    const asideBottom = aside.getBoundingClientRect().bottom + window.scrollY
    expect(asideBottom - mainBottom, 'aside continues after main').to.be.lte(240)
  })
}

function openDashboardTab(label) {
  cy.get('[data-testid="dashboard-tabs"] button').contains(label).click()
}

describe('Release 8.2 dashboard layout contract', () => {
  for (const [width, height] of [[390, 844], [768, 1024], [1366, 768], [1440, 900]]) {
    it(`keeps dashboard balanced at ${width}x${height}`, () => {
      visitDashboard(width, height)
      cy.get('[data-testid="executive-hero"]').should('be.visible')
      cy.get('[data-dashboard-section="dashboard-kpis"]').should('be.visible')
      expectNoOverflow()
      expectNoLargeVerticalGap()

      openDashboardTab('Despesas')
      cy.get('[data-dashboard-section="recent-entries"]').should('be.visible')
      cy.get('[data-dashboard-section="budget-summary"]').should('be.visible')
      cy.get('[data-dashboard-section="category-summary"]').should('be.visible')
      expectNoOverflow()
      expectNoLargeVerticalGap()
      if (width >= 1024) expectDesktopColumnsBalanced()

      openDashboardTab('Resumo')
      cy.contains('summary', 'Plano e alertas').click()
      cy.get('[data-dashboard-section="month-plan"]').should('be.visible')
      expectNoOverflow()

      openDashboardTab('Análises')
      cy.contains('summary', 'Mais análises').click()
      cy.get('[data-dashboard-section="dashboard-assistant"]').should('be.visible')
      expectNoOverflow()

      openDashboardTab('Entrada de dados')
      cy.get('[data-dashboard-section="quick-entry"]').should('be.visible')
      expectNoOverflow()
    })
  }
})
