const STORAGE_KEY = 'controle-financeiro-app-v2'
const scopedStorageKey = (userId = '99999999-9999-4999-9999-999999999999') => `${STORAGE_KEY}:${userId}`

function install(win) {
  const user = { id: '99999999-9999-4999-9999-999999999999', email: 'release9@example.com' }
  const session = { access_token: 'e2e-token', user }
  const result = { data: null, error: null }
  let chain
  chain = new Proxy({}, {
    get(_target, property) {
      if (property === 'then') return (resolve) => Promise.resolve(result).then(resolve)
      if (property === 'single' || property === 'maybeSingle') return () => Promise.resolve(result)
      return () => chain
    },
  })
  win.SUPABASE_CONFIG = { url: 'https://example.supabase.co', anonKey: 'e2e-anon' }
  win.supabase = {
    auth: {
      getSession: async () => ({ data: { session }, error: null }),
      getUser: async () => ({ data: { user }, error: null }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
    },
    from: () => chain,
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

function state() {
  return {
    settings: { year: 2026, selectedMonth: 6, currentMemberId: 'member-1', minimumReserve: 1000 },
    familyMembers: [{ id: 'member-1', name: 'Release 9', role: 'administrator' }],
    financialAccounts: [{ id: 'account-1', name: 'Conta', balance: 6000 }],
    incomes: [{ id: 'i1', date: '2026-06-05', type: 'Salario', amount: 5000 }],
    expenses: [{ id: 'e1', date: '2026-06-02', category: 'Mercado', amount: 900, payment: 'Pix' }],
    categoryBudgets: [{ id: 'b1', month_key: 202606, category: 'Mercado', planned: 1200 }],
    planningGoals: [],
    wishlist: [],
  }
}

function visitDashboard() {
  cy.visit('/dashboard', { onBeforeLoad(win) { install(win); win.localStorage.setItem(scopedStorageKey(), JSON.stringify(state())) } })
}

describe('Release 9 dashboard advisor cards', () => {
  it('shows only advisor summary cards on the dashboard', () => {
    visitDashboard()
    cy.get('[data-testid="dashboard-advisor-cards"]').should('contain.text', 'Fechamento previsto')
    cy.get('[data-testid="dashboard-advisor-cards"]').should('contain.text', 'Capacidade segura')
    cy.get('[data-testid="dashboard-advisor-cards"]').should('contain.text', 'Principal risco')
    cy.get('[data-testid="dashboard-advisor-cards"]').contains('button', 'Abrir Consultor').click()
    cy.location('pathname').should('eq', '/advisor')
  })
})
