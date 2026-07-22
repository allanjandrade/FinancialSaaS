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
    functions: { invoke: async () => ({ data: null, error: null }) },
  }
}

function state() {
  return {
    settings: { year: 2026, selectedMonth: 6, currentMemberId: 'member-1' },
    family: { id: 'family-8' },
    familyMembers: [{ id: 'member-1', name: 'Usuario Release 8', role: 'administrator' }],
    financialAccounts: [{ id: 'account-1', name: 'Conta', type: 'Conta Corrente', balance: 5000 }],
    creditCards: [{ id: 'card-1', name: 'Cartao', limit: 8000, availableLimit: 7600, closingDay: 20, dueDay: 8 }],
    benefitWallets: [],
    incomes: [
      { id: 'i1', date: '2026-05-05', type: 'Salario', amount: 4800 },
      { id: 'i2', date: '2026-06-05', type: 'Salario', amount: 5200 },
    ],
    expenses: [
      { id: 'e1', date: '2026-05-10', category: 'Mercado', payment: 'Pix', amount: 600 },
      { id: 'e2', date: '2026-06-10', category: 'Mercado', payment: 'Pix', amount: 760 },
      { id: 'e3', date: '2026-06-12', category: 'Assinaturas', payment: 'Credito', amount: 180, cardCompetencyMonth: 6, cardCompetencyYear: 2026 },
    ],
    wishlist: [],
    internalTransfers: [],
  }
}

function visitApp(path) {
  cy.visit(path, {
    onBeforeLoad(win) {
      installSupabaseStub(win)
      win.localStorage.setItem(scopedStorageKey(), JSON.stringify(state()))
    },
  })
}

describe('Release 8 dashboard and reports separation', () => {
  it('renders Dashboard as now-cockpit with next action', () => {
    visitApp('/dashboard')
    cy.get('[data-testid="executive-hero"]').should('contain.text', 'Como estou agora?')
    cy.contains('Proxima melhor acao').should('exist')
    cy.get('[data-testid="reports-period-filter"]').should('not.exist')
  })

  it('renders Reports as historical analysis with filters and category analysis', () => {
    visitApp('/reports')
    cy.get('[data-testid="reports-page"]').should('contain.text', 'Análise do período')
    cy.get('[data-testid="reports-period-filter"]').should('exist')
    cy.get('[data-testid="reports-comparison"]').should('contain.text', 'vs mês anterior')
    cy.get('[data-testid="reports-category-analysis"]').should('contain.text', 'Gastos por categoria')
    cy.get('[data-testid="reports-trends"]').should('contain.text', 'Evolução temporal')
    cy.get('[data-testid="executive-hero"]').should('not.exist')
  })
})
