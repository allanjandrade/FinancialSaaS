const STORAGE_KEY = 'controle-financeiro-app-v2'
const scopedStorageKey = (userId = '77777777-7777-4777-8777-777777777777') => `${STORAGE_KEY}:${userId}`

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
  const user = { id: '77777777-7777-4777-8777-777777777777', email: 'release7@example.com' }
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

function visitApp(path, state = null) {
  cy.visit(path, {
    onBeforeLoad(win) {
      installSupabaseStub(win)
      win.localStorage.clear()
      if (state) win.localStorage.setItem(scopedStorageKey(), JSON.stringify(state))
    },
  })
}

function configuredState() {
  return {
    settings: { year: 2026, selectedMonth: 6, currentMemberId: 'member-1' },
    family: { id: 'family-7', name: 'Familia Release 7' },
    familyMembers: [{ id: 'member-1', name: 'Usuario Release 7', role: 'administrator' }],
    financialAccounts: [{ id: 'account-1', name: 'Conta principal', type: 'Conta Corrente', balance: 4200 }],
    creditCards: [{ id: 'card-1', name: 'Cartao principal', limit: 8000, availableLimit: 6200, closingDay: 20, dueDay: 8 }],
    benefitWallets: [],
    incomes: [{ id: 'income-1', date: '2026-06-05', type: 'Salario', amount: 5000, sourceId: 'account-1' }],
    expenses: [],
    wishlist: [],
    internalTransfers: [],
  }
}

describe('Release 7 user experience', () => {
  it('usuario novo encontra o onboarding a partir do inicio', () => {
    visitApp('/dashboard')
    cy.contains('Comece configurando sua vida financeira').should('exist')
    cy.contains('Comecar configuracao').click()
    cy.location('pathname').should('eq', '/onboarding')
  })

  it('conclui onboarding e mostra saldo seguro no dashboard', () => {
    visitApp('/onboarding')
    cy.get('[data-testid="onboarding-page"]').should('contain.text', 'Perfil financeiro basico')
    cy.contains('button', 'Continuar').click()
    cy.get('[data-testid="onboarding-salary"]').clear().type('5000')
    cy.contains('button', 'Continuar').click()
    cy.get('[data-testid="onboarding-account-name"]').clear().type('Conta principal')
    cy.get('[data-testid="onboarding-account-balance"]').clear().type('1200')
    cy.get('[data-testid="onboarding-card-name"]').clear().type('Cartao principal')
    cy.get('[data-testid="onboarding-card-limit"]').clear().type('7000')
    cy.contains('button', 'Continuar').click()
    cy.get('[data-testid="onboarding-sample-expense"]').clear().type('180')
    cy.contains('button', 'Continuar').click()
    cy.get('[data-testid="onboarding-finish"]').click()
    cy.location('pathname', { timeout: 4000 }).should('eq', '/dashboard')
    cy.get('[data-testid="executive-hero"]').should('contain.text', 'Voce pode gastar')
    cy.window().then((win) => {
      const saved = JSON.parse(win.localStorage.getItem(scopedStorageKey()))
      expect(saved.settings.onboardingCompletedAt).to.be.a('string')
    })
  })

  it('estado vazio de lancamentos tem CTAs claros', () => {
    visitApp('/entries', { ...configuredState(), incomes: [], expenses: [] })
    cy.contains('Nenhum lançamento ainda').should('exist')
    cy.contains('Cadastrar receita').click()
    cy.get('.segmented .segment').contains('Receita').should('have.class', 'active')
    cy.contains('Cadastrar despesa').click()
    cy.get('.segmented .segment').contains('Despesa').should('have.class', 'active')
  })

  it('modo demo carrega no mobile sem gravar estado real nem gerar overflow horizontal', () => {
    cy.viewport(390, 844)
    visitApp('/dashboard?demo=1', configuredState())
    cy.contains('Modo demonstracao: estes dados sao ficticios e nao alteram sua conta.').should('exist')
    cy.window().then((win) => {
      win.__release7BeforeDemo = win.localStorage.getItem(scopedStorageKey())
      expect(win.document.documentElement.scrollWidth).to.be.lte(win.innerWidth + 1)
    })
    cy.contains('Copiloto').should('exist')
    cy.window().then((win) => {
      expect(win.localStorage.getItem(scopedStorageKey())).to.equal(win.__release7BeforeDemo)
    })
  })
})
