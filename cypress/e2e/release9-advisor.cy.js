const STORAGE_KEY = 'controle-financeiro-app-v2'
const scopedStorageKey = (userId = '99999999-9999-4999-9999-999999999999') => `${STORAGE_KEY}:${userId}`

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
  const user = { id: '99999999-9999-4999-9999-999999999999', email: 'release9@example.com' }
  const session = { access_token: 'e2e-token', user }
  win.SUPABASE_CONFIG = { url: 'https://example.supabase.co', anonKey: 'e2e-anon' }
  win.supabase = {
    auth: {
      getSession: async () => ({ data: { session }, error: null }),
      getUser: async () => ({ data: { user }, error: null }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
    },
    from: () => queryResult(null),
    rpc: () => Promise.resolve({ data: null, error: null }),
    channel: () => ({ on: () => ({ subscribe: () => ({}) }) }),
    removeChannel: () => {},
    functions: {
      invoke: async (name) => {
        if (name === 'admin-current-user') return { data: { is_admin: false, role: 'user', permissions: [] }, error: null }
        if (name === 'entitlements-resolve') return {
          data: {
            plan_code: 'premium_monthly',
            is_tester: false,
            features: { predictive_advisor: true, scenario_simulation: true, smart_actions: true, price_search: true, automations: true },
            limits: { price_search_monthly: 50, automations_active: 10, wishlist_items: null },
          },
          error: null,
        }
        return { data: null, error: null }
      },
    },
  }
}

function release9State() {
  return {
    settings: { year: 2026, selectedMonth: 6, currentMemberId: 'member-1', minimumReserve: 1000 },
    familyMembers: [{ id: 'member-1', name: 'Release 9', role: 'administrator' }],
    financialAccounts: [{ id: 'account-1', name: 'Conta', balance: 6000 }],
    creditCards: [],
    benefitWallets: [],
    incomes: [{ id: 'i1', date: '2026-06-05', type: 'Salario', amount: 5000 }],
    expenses: [
      { id: 'e1', date: '2026-06-02', category: 'Mercado', amount: 900, payment: 'Pix' },
      { id: 'e2', date: '2026-06-10', category: 'Lazer', amount: 500, payment: 'Pix' },
      { id: 'e3', date: '2026-06-12', category: 'Outros', amount: 1000, isInternalTransfer: true },
      { id: 'e4', date: '2026-06-12', category: 'Mercado', amount: 300, payment: 'VA' },
    ],
    categoryBudgets: [
      { id: 'b1', month_key: 202606, category: 'Mercado', planned: 1200 },
      { id: 'b2', month_key: 202606, category: 'Lazer', planned: 400 },
    ],
    planningGoals: [],
    wishlist: [],
  }
}

function visitApp(path) {
  cy.visit(path, {
    onBeforeLoad(win) {
      installSupabaseStub(win)
      win.localStorage.setItem(scopedStorageKey(), JSON.stringify(release9State()))
    },
  })
}

describe('Release 9 advisor', () => {
  it('renders deterministic advisor report and records controlled feedback', () => {
    visitApp('/advisor')

    cy.get('[data-testid="breadcrumb"]').should('contain.text', 'Inteligência').and('contain.text', 'Consultor')
    cy.get('[data-testid="advisor-summary"]').should('contain.text', 'Fechamento previsto').and('contain.text', 'Capacidade segura')
    cy.get('[data-testid="advisor-categories"]').should('contain.text', 'Mercado').and('contain.text', 'Lazer')
    cy.get('[data-testid="advisor-report"]').should('contain.text', 'Fechamento provavel do mes')
    cy.get('[data-testid="advisor-recommendations"]').contains('button', 'Util').click()
    cy.get('[data-testid="advisor-recommendations"]').should('contain.text', 'Feedback registrado')
  })
})
