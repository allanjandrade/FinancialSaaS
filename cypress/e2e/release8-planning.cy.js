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
            features: { scenario_simulation: true, predictive_advisor: true, smart_actions: true, price_search: true, automations: true },
            limits: { price_search_monthly: 50, automations_active: 10, wishlist_items: null },
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
    settings: { year: 2026, selectedMonth: 6, cardClosingDay: 20, currentMemberId: 'member-1' },
    family: { id: 'family-8', name: 'Familia Release 8' },
    familyMembers: [{ id: 'member-1', name: 'Usuario Release 8', role: 'administrator' }],
    financialAccounts: [{ id: 'account-1', name: 'Conta principal', type: 'Conta Corrente', balance: 5000 }],
    creditCards: [{ id: 'card-1', name: 'Cartao principal', limit: 9000, availableLimit: 8000, closingDay: 20, dueDay: 8 }],
    benefitWallets: [{ id: 'va-1', name: 'VA', kind: 'va', balance: 600 }],
    incomes: [
      { id: 'income-1', date: '2026-06-05', type: 'Salario', amount: 6000, sourceId: 'account-1' },
      { id: 'income-2', date: '2026-06-05', type: 'VA', amount: 600, sourceId: 'va-1' },
    ],
    expenses: [
      { id: 'expense-1', date: '2026-06-06', category: 'Mercado', payment: 'Debito', amount: 350 },
      { id: 'expense-2', date: '2026-06-07', category: 'Mercado', payment: 'VA', amount: 180 },
      { id: 'expense-3', date: '2026-06-08', category: 'Outros', payment: 'Pix', amount: 900, isInternalTransfer: true },
      { id: 'expense-4', date: '2026-06-12', category: 'Cartao', payment: 'Credito', amount: 700, cardCompetencyMonth: 6, cardCompetencyYear: 2026 },
    ],
    wishlist: [],
    planningGoals: [],
    categoryBudgets: [],
    internalTransfers: [],
  }
}

function visitPlan(path = '/plan', state = release8State()) {
  cy.visit(path, {
    onBeforeLoad(win) {
      installSupabaseStub(win)
      win.localStorage.clear()
      win.localStorage.setItem(scopedStorageKey(), JSON.stringify(state))
    },
  })
}

describe('Release 8 planning, goals, budget and wishlist identity', () => {
  it('opens the monthly plan with deterministic cards', () => {
    visitPlan()
    cy.get('[data-testid="release8-planning"]').should('contain.text', 'Plano do mes')
    cy.contains('Receita em dinheiro').should('exist')
    cy.contains('Saldo seguro').should('exist')
  })

  it('creates a financial goal without creating a transaction', () => {
    visitPlan()
    cy.get('[data-testid="goal-name"]').type('Reserva Release 8')
    cy.get('[data-testid="goal-target"]').clear().type('12000')
    cy.contains('Salvar meta').click()
    cy.contains('Reserva Release 8').should('exist')
    cy.window().then((win) => {
      const saved = JSON.parse(win.localStorage.getItem(scopedStorageKey()))
      expect(saved.planningGoals).to.have.length(1)
      expect(saved.expenses).to.have.length(4)
    })
  })

  it('creates a Mercado budget excluding VA and internal transfer residue', () => {
    visitPlan()
    cy.get('[data-testid="budget-category"]').select('Mercado')
    cy.get('[data-testid="budget-planned"]').clear().type('700')
    cy.get('[data-testid="budget-submit"]').click()
    cy.get('[data-testid="planning-budget"]').should('contain.text', 'Mercado')
    cy.contains('.budget-row', 'Mercado').should('contain.text', '350,00')
    cy.get('[data-testid="planning-budget"]').should('not.contain.text', '900,00')
  })

  it('simulates a purchase and keeps financial entries unchanged', () => {
    visitPlan('/plan/purchase-simulator')
    cy.get('[data-testid="sim-item"]').type('Monitor')
    cy.get('[data-testid="sim-amount"]').clear().type('600')
    cy.get('[data-testid="sim-category"]').select('Outros')
    cy.get('[data-testid="sim-submit"]').click()
    cy.get('[data-testid="sim-result"]').should('contain.text', 'Nenhuma trans')
    cy.window().then((win) => {
      const saved = JSON.parse(win.localStorage.getItem(scopedStorageKey()))
      expect(saved.expenses).to.have.length(4)
      expect(saved.incomes).to.have.length(2)
    })
  })

  it('confirms Fiat Punto right identity and rejects incompatible cheaper offers', () => {
    visitPlan()
    cy.get('[data-testid="wishlist-text"]').clear().type('lanterna tras ld punto')
    cy.get('[data-testid="wishlist-target"]').clear().type('350')
    cy.get('[data-testid="wishlist-review"]').click()
    cy.get('[data-testid="identity-review"]').should('contain.text', 'Peca: Lanterna traseira / Lado: Direito / Veiculo: Fiat Punto')
    cy.get('[data-testid="identity-confirm"]').click()
    cy.get('[data-testid="wishlist-row"]').should('contain.text', 'cotacao pendente')
    cy.get('[data-testid="mock-candidates"]').click()
    cy.get('[data-testid="wishlist-row"]').should('contain.text', 'compativel')
    cy.get('[data-testid="wishlist-row"]').should('contain.text', 'Alerta permitido')
    cy.window().then((win) => {
      const item = JSON.parse(win.localStorage.getItem(scopedStorageKey())).wishlist[0]
      expect(item.value).to.equal(320)
      expect(item.last_rejected_candidates.map((row) => row.title).join(' ')).to.include('Palio')
      expect(item.last_rejected_candidates.map((row) => row.title).join(' ')).to.include('Siena')
      expect(item.last_rejected_candidates.map((row) => row.title).join(' ')).to.include('Hilux')
    })
  })

  it('keeps the planning and compatibility review usable on 390px mobile without overflow', () => {
    cy.viewport(390, 844)
    visitPlan()
    cy.get('[data-testid="wishlist-text"]').clear().type('lanterna tras ld punto')
    cy.get('[data-testid="wishlist-review"]').click()
    cy.get('[data-testid="identity-review"]').should('be.visible')
    cy.window().then((win) => {
      expect(win.document.documentElement.scrollWidth).to.be.lte(win.innerWidth + 1)
    })
  })
})
