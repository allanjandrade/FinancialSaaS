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

function installSupabaseStub(win) {
  const user = { id: '11111111-1111-4111-8111-111111111111', email: 'release3@example.com' }
  const session = { access_token: 'e2e-token', user }
  const channel = { on: () => channel, subscribe: () => channel }
  win.SUPABASE_CONFIG = { url: 'https://example.supabase.co', anonKey: 'e2e-anon' }
  win.supabase = {
    auth: {
      getSession: async () => ({ data: { session }, error: null }),
      getUser: async () => ({ data: { user }, error: null }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
    },
    from: () => queryResult(null), rpc: () => Promise.resolve({ data: null, error: null }),
    channel: () => channel, removeChannel: () => {}, functions: { invoke: async () => ({ data: null, error: null }) },
  }
}

function state() {
  return {
    settings: { year: 2026, selectedMonth: 6, currentMemberId: 'member-1' },
    family: { id: 'family-1', name: 'Familia E2E' },
    familyMembers: [{ id: 'member-1', name: 'Usuario', role: 'administrator' }],
    financialAccounts: [{ id: 'account-1', name: 'Conta', type: 'Conta Corrente', balance: 5000 }],
    creditCards: [], benefitWallets: [], incomes: [], expenses: [], internalTransfers: [],
    wishlist: [{ id: 'wish-1', name: 'Notebook', value: 2500, currentPrice: 2500, priceStatus: 'quoted' }],
  }
}

function visit(path) {
  cy.visit(path, { onBeforeLoad(win) { installSupabaseStub(win); win.localStorage.setItem(scopedStorageKey(), JSON.stringify(state())) } })
}

function submit(question = 'O que merece atencao?') {
  cy.get('[data-testid="ai-assist-input"]').clear().type(question)
  cy.get('[data-testid="ai-assist-submit"]').click()
}

function successBody(overrides = {}) {
  return {
    answer: 'Os dados indicam estabilidade com um ponto de atencao.', confidence: 'high', basis: ['Motor financeiro'],
    warnings: [], suggested_questions: ['O que mudou?'], suggested_actions: [], ...overrides,
  }
}

describe('Release 3 contextual assistant', () => {
  it('answers from the dashboard without sending financial context from the browser', () => {
    cy.intercept('POST', '**/functions/v1/ai-assist', (req) => {
      expect(req.body).to.deep.equal({ context_type: 'dashboard', entity_id: null, user_query: 'O que merece atencao?' })
      req.reply(successBody())
    })
    visit('/dashboard'); submit(); cy.get('[data-testid="ai-assist-result"]').should('contain.text', 'estabilidade')
  })

  it('guides the user to consent settings before analysis', () => {
    cy.intercept('POST', '**/functions/v1/ai-assist', { statusCode: 403, body: { error: { code: 'CONSENT_REQUIRED', message: 'Consentimento necessario.' } } })
    visit('/entries'); submit(); cy.get('[data-testid="ai-consent-required"]').should('contain.text', 'Consentimento')
  })

  it('shows quota exceeded without unsafe fallback', () => {
    cy.intercept('POST', '**/functions/v1/ai-assist', { statusCode: 429, body: { error: { code: 'AI_DAILY_LIMIT_REACHED', message: 'Limite diario atingido.' } } })
    visit('/dashboard'); submit(); cy.get('[data-testid="ai-quota-exceeded"]').should('contain.text', 'Limite')
  })

  it('renders purchase guidance as explicitly non executable', () => {
    cy.intercept('POST', '**/functions/v1/ai-assist', { body: successBody({ suggested_actions: [{ label: 'Revisar a compra', executable: false }] }) })
    visit('/compras-ia/wishlist'); submit('Esta compra cabe no orcamento?')
    cy.get('[data-testid="ai-readonly-actions"]').should('contain.text', 'nao executavel').find('button').should('not.exist')
  })

  it('explains report anomalies without changing financial state', () => {
    cy.intercept('POST', '**/functions/v1/ai-assist', { body: successBody({ answer: 'A categoria Mercado ficou acima do historico.' }) })
    visit('/reports')
    cy.get('[data-testid="ai-assist-input"]').should('be.visible')
    cy.window().then((win) => { win.__stateBeforeAi = win.localStorage.getItem(scopedStorageKey()) })
    submit('Quais anomalias aparecem?')
    cy.get('[data-testid="ai-assist-result"]').should('contain.text', 'Mercado')
    cy.window().then((win) => expect(win.localStorage.getItem(scopedStorageKey())).to.equal(win.__stateBeforeAi))
  })

  it('shows a controlled error when the provider is unavailable', () => {
    cy.intercept('POST', '**/functions/v1/ai-assist', { statusCode: 503, body: { error: { code: 'AI_UNAVAILABLE', message: 'Tente novamente mais tarde.' } } })
    visit('/dashboard'); submit(); cy.get('[data-testid="ai-assist-error"]').should('contain.text', 'Tente novamente')
  })
})
