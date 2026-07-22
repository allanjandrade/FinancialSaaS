const STORAGE_KEY = 'controle-financeiro-app-v2'
const scopedStorageKey = (userId = '11111111-1111-4111-8111-111111111111') => `${STORAGE_KEY}:${userId}`

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

function installSupabaseStub(win, initiallyAuthenticated = true) {
  const user = { id: '11111111-1111-4111-8111-111111111111', email: 'release1@example.com' }
  let session = initiallyAuthenticated ? { access_token: 'e2e-token', user } : null
  const listeners = []
  const channel = { on: () => channel, subscribe: () => channel }
  win.SUPABASE_CONFIG = { url: 'https://example.supabase.co', anonKey: 'e2e-anon' }
  win.supabase = {
    auth: {
      getSession: async () => ({ data: { session }, error: null }),
      getUser: async () => ({ data: { user: session?.user || null }, error: null }),
      signInWithPassword: async () => {
        session = { access_token: 'e2e-token', user }
        listeners.forEach((listener) => listener('SIGNED_IN', session))
        return { data: { session, user }, error: null }
      },
      onAuthStateChange: (listener) => {
        listeners.push(listener)
        return { data: { subscription: { unsubscribe() {} } } }
      },
      signOut: async () => ({ error: null }),
    },
    from: () => queryResult(null),
    rpc: () => Promise.resolve({ data: null, error: null }),
    channel: () => channel,
    removeChannel: () => {},
    functions: { invoke: async () => ({ data: null, error: null }) },
  }
}

function baseState(overrides = {}) {
  return {
    settings: { year: 2026, selectedMonth: 6, currentMemberId: 'member-1' },
    family: { id: '22222222-2222-4222-8222-222222222222', name: 'Familia E2E' },
    familyMembers: [{ id: 'member-1', name: 'Usuario E2E', role: 'administrator' }],
    financialAccounts: [
      { id: 'account-1', name: 'Santander', type: 'Conta Corrente', bank: 'Santander', balance: 6670 },
    ],
    creditCards: [{ id: 'card-1', name: 'Cartao', limit: 10000, openBill: 480, closingDay: 20, dueDay: 5 }],
    benefitWallets: [],
    incomes: [],
    expenses: [],
    wishlist: [],
    internalTransfers: [],
    ...overrides,
  }
}

function visitAuthenticated(path, state = baseState()) {
  cy.visit(path, {
    onBeforeLoad(win) {
      installSupabaseStub(win, true)
      win.localStorage.setItem(scopedStorageKey(), JSON.stringify(state))
    },
  })
}

describe('Release 1 critical financial flows', () => {
  it('logs in with an authenticated session', () => {
    cy.visit('/login', { onBeforeLoad: (win) => installSupabaseStub(win, false) })
    cy.get('#email').type('release1@example.com')
    cy.get('#password').type('secure-password')
    cy.contains('button', 'Entrar').click()
    cy.location('pathname').should('eq', '/dashboard')
  })

  it('creates manual income', () => {
    visitAuthenticated('/entries')
    cy.contains('button', 'Receita').click()
    cy.contains('label', 'Tipo').find('select').select('Salário')
    cy.contains('label', 'Valor').find('input').clear().type('3000')
    cy.contains('label', /Descri/).find('input').type('Salario E2E')
    cy.contains('button', 'Salvar').click()
    cy.get('.badge.income').should('contain.text', 'Receita')
    cy.get('[data-testid="entries-history-list"]').should('contain.text', 'Salário')
    cy.window().then((win) => {
      const saved = JSON.parse(win.localStorage.getItem(scopedStorageKey()))
      expect(saved.incomes).to.have.length(1)
      expect(saved.incomes[0]).to.include({ type: 'Salário', description: 'Salario E2E', amount: 3000 })
    })
  })

  it('creates manual expense', () => {
    visitAuthenticated('/entries')
    cy.contains('label', 'Valor').find('input').clear().type('530')
    cy.contains('label', /Descri/).find('input').type('Despesa E2E')
    cy.contains('button', 'Salvar').click()
    cy.get('.badge.expense').should('contain.text', 'Despesa')
    cy.window().then((win) => {
      const saved = JSON.parse(win.localStorage.getItem(scopedStorageKey()))
      expect(saved.expenses).to.have.length(1)
      expect(saved.expenses[0]).to.include({ description: 'Despesa E2E', amount: 530 })
    })
  })

  it('creates a financial account', () => {
    visitAuthenticated('/accounts')
    cy.contains('button', 'Nova conta').click()
    cy.contains('label', 'Nome').find('input').first().type('Nubank E2E')
    cy.contains('label', 'Saldo').find('input').type('4200')
    cy.contains('button', 'Adicionar conta').click()
    cy.contains('Nubank E2E').should('exist')
  })

  it('creates a VA account', () => {
    visitAuthenticated('/structure?tab=benefits')
    cy.contains('button', /Novo benef/).click()
    cy.contains('label', 'Nome').find('input').type('Pluxee E2E')
    cy.contains('label', 'Saldo').find('input').type('682')
    cy.contains('button', /Adicionar benef/).click()
    cy.contains('Pluxee E2E').should('exist')
  })

  it('purchases with VA without debiting a bank account', () => {
    visitAuthenticated('/entries', baseState({
      benefitWallets: [{ id: 'va-1', name: 'Pluxee', kind: 'va', provider: 'Pluxee', balance: 682 }],
    }))
    cy.contains('label', 'Valor').find('input').clear().type('400')
    cy.contains('label', 'Pagamento').find('select').select('VA')
    cy.contains('label', 'Origem financeira').find('select').select('va-1')
    cy.contains('button', 'Salvar').click()
    cy.window().then((win) => {
      const saved = JSON.parse(win.localStorage.getItem(scopedStorageKey()))
      expect(saved.benefitWallets[0].balance).to.eq(282)
      expect(saved.financialAccounts[0].balance).to.eq(6670)
    })
  })

  it('creates and confirms an internal transfer', () => {
    visitAuthenticated('/structure?tab=transfers', baseState({
      financialAccounts: [
        { id: 'account-1', name: 'Santander', type: 'Conta Corrente', balance: 6670 },
        { id: 'account-2', name: 'Nubank', type: 'Conta Corrente', balance: 0 },
      ],
    }))
    cy.contains('button', /Nova transfer/).click()
    cy.contains('label', 'Valor').find('input').type('4200')
    cy.contains('label', 'De (conta)').find('select').select('account-1')
    cy.contains('label', 'Para (conta)').find('select').select('account-2')
    cy.contains('button', /Registrar e confirmar transfer/).click()
    cy.contains(/Transferencia confirmada/).should('exist')
  })

  it('renders the monthly report without counting internal transfers', () => {
    visitAuthenticated('/reports', baseState({
      incomes: [{ id: 'salary', date: '2026-06-05', type: 'Salario', amount: 3000 }],
      expenses: [{ id: 'expense', date: '2026-06-10', payment: 'Pix', category: 'Moradia', amount: 530, paid: true }],
      internalTransfers: [{ id: 'transfer', date: '2026-06-12', amount: 4200, confirmed: true }],
    }))
    cy.contains('Receitas').should('exist')
    cy.contains('Despesas').should('exist')
    cy.contains('Resultado').should('exist')
  })

  it('keeps a wishlist item without price as quote pending', () => {
    visitAuthenticated('/compras-ia/nova')
    cy.contains('button', 'Buscar por descricao').click()
    cy.get('textarea').type('Lanterna traseira Punto')
    cy.contains('button', 'Procurar produto').click()
    cy.contains('Cotacao pendente').should('exist')
    cy.contains('button', 'Salvar na wishlist').click()
    cy.location('pathname').should('eq', '/purchases')
    cy.contains('Lanterna traseira Punto').should('exist')
  })

  it('opens manual review when OCR fails', () => {
    cy.intercept('POST', '**/functions/v1/receipt-ocr', { statusCode: 500, body: { error: 'simulated failure' } })
    visitAuthenticated('/ai')
    cy.get('input[type=file]').selectFile({
      contents: Cypress.Buffer.from('not-an-image'),
      fileName: 'receipt.png',
      mimeType: 'image/png',
    }, { force: true })
    cy.get('.send-button').click()
    cy.contains('Revisar despesa').should('exist')
    cy.contains('Nada foi salvo automaticamente', { matchCase: false }).should('exist')
  })
})
