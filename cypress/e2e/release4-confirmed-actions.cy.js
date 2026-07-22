const STORAGE_KEY = 'controle-financeiro-app-v2'
const scopedStorageKey = (userId = '11111111-1111-4111-8111-111111111111') => `${STORAGE_KEY}:${userId}`

function queryResult(data = null) {
  const result = { data, error: null }; let chain
  chain = new Proxy({}, { get(_target, property) { if (property === 'then') return (resolve) => Promise.resolve(result).then(resolve); if (property === 'single' || property === 'maybeSingle') return () => Promise.resolve(result); return () => chain } })
  return chain
}

function visit() {
  cy.visit('/dashboard', { onBeforeLoad(win) {
    const user = { id: '11111111-1111-4111-8111-111111111111', email: 'release4@example.com' }
    const session = { access_token: 'e2e-token', user }; const channel = { on: () => channel, subscribe: () => channel }
    win.SUPABASE_CONFIG = { url: 'https://example.supabase.co', anonKey: 'e2e-anon' }
    win.supabase = { auth: { getSession: async () => ({ data: { session }, error: null }), getUser: async () => ({ data: { user }, error: null }), onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }) }, from: () => queryResult(null), rpc: () => Promise.resolve({ data: null, error: null }), channel: () => channel, removeChannel: () => {}, functions: { invoke: async () => ({ data: null, error: null }) } }
    win.localStorage.setItem(scopedStorageKey(), JSON.stringify({ settings: { year: 2026, selectedMonth: 6 }, family: { id: 'family-1' }, familyMembers: [], financialAccounts: [], creditCards: [], benefitWallets: [], incomes: [], expenses: [], wishlist: [] }))
  } })
}

function prepareAction() {
  cy.intercept('POST', '**/functions/v1/ai-assist', { body: { answer: 'Sugestao pronta para revisao.', confidence: 'high', basis: ['Motor financeiro'], warnings: [], suggested_questions: [], suggested_actions: [{ label: 'Registrar mercado', executable: false, action_type: 'create_transaction', payload: { kind: 'expense', amount: 50, date: '2026-06-13', description: 'Mercado', category: 'Alimentacao' } }] } })
  cy.intercept('POST', '**/functions/v1/propose-action', (req) => {
    expect(req.body).not.to.have.keys('user_id', 'family_id', 'finance_state')
    req.reply({ statusCode: 201, body: { draft: { id: 'draft-1', preview: { title: 'Criar despesa', summary: 'Mercado', payload: req.body.payload } }, confirmation_token: 'opaque-token' } })
  }).as('propose')
  visit(); cy.get('[data-testid="ai-assist-input"]').type('Registre este gasto'); cy.get('[data-testid="ai-assist-submit"]').click(); cy.contains('button', 'Registrar mercado').click(); cy.wait('@propose')
}

describe('Release 4 confirmed actions', () => {
  it('does not write before the explicit modal confirmation', () => {
    let confirmations = 0
    cy.intercept('POST', '**/functions/v1/confirm-action', (req) => { confirmations += 1; expect(req.body).not.to.have.keys('payload', 'action_type', 'user_id', 'family_id'); req.reply({ body: { ok: true, log_id: 'log-1' } }) }).as('confirm')
    prepareAction(); cy.get('[data-testid="ai-action-confirmation"]').should('contain.text', 'Mercado').then(() => expect(confirmations).to.equal(0)); cy.get('[data-testid="ai-action-confirm"]').click(); cy.wait('@confirm')
  })

  it('cancels a proposal without calling confirmation', () => {
    cy.intercept('POST', '**/functions/v1/confirm-action', () => { throw new Error('confirm-action nao deveria ser chamado') })
    prepareAction(); cy.contains('button', 'Cancelar').click(); cy.get('[data-testid="ai-action-confirmation"]').should('not.exist')
  })

  it('keeps the review open when the financial state changed', () => {
    cy.intercept('POST', '**/functions/v1/confirm-action', { statusCode: 409, body: { error: { code: 'STATE_CHANGED', message: 'Os dados financeiros mudaram. Revise a acao antes de confirmar.' } } })
    prepareAction(); cy.get('[data-testid="ai-action-confirm"]').click(); cy.get('[data-testid="ai-action-confirmation"]').should('contain.text', 'dados financeiros mudaram')
  })
})
