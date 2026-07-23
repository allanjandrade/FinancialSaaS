const STORAGE_KEY = 'controle-financeiro-app-v2'
const user = { id: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', email: 'description@example.com' }

function scopedKey(currentUser) {
  return `${STORAGE_KEY}:${currentUser.id}`
}

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
  const session = { access_token: `token-${user.id}`, user }
  const channel = { on: () => channel, subscribe: () => channel }
  win.SUPABASE_CONFIG = { url: 'https://example.supabase.co', anonKey: 'e2e-anon' }
  win.supabase = {
    auth: {
      getSession: async () => ({ data: { session }, error: null }),
      getUser: async () => ({ data: { user }, error: null }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
      signOut: async () => ({ error: null }),
    },
    from: () => queryResult(null),
    rpc: () => Promise.resolve({ data: null, error: null }),
    channel: () => channel,
    removeChannel: () => {},
    functions: { invoke: async () => ({ data: null, error: null }) },
  }
}

function baseState() {
  return {
    settings: { year: 2026, selectedMonth: 6, currentMemberId: 'member-1' },
    family: { id: 'family-description', name: 'Familia Description' },
    familyMembers: [{ id: 'member-1', name: 'Usuario Description', role: 'administrator' }],
    financialAccounts: [],
    creditCards: [],
    benefitWallets: [],
    incomes: [],
    expenses: [],
    wishlist: [],
    internalTransfers: [],
  }
}

describe('Release 11 product search by description', () => {
  it('normalizes abbreviated text and saves a strict product identity for the logged user', () => {
    cy.intercept('POST', '**/functions/v1/price-search', {
      statusCode: 200,
      body: {
        status: 'not_found',
        offers: [],
        accepted_candidates: [],
        ambiguous_candidates: [],
        rejected_candidates: [],
        diagnostics: ['e2e:not-found'],
      },
    })
    cy.intercept('POST', '**/functions/v1/marketplace-search', {
      statusCode: 200,
      body: { status: 'not_found', offers: [], diagnostics: ['e2e:not-found'] },
    })
    cy.intercept('POST', '/api/product-lookup', {
      statusCode: 200,
      body: { status: 'not_found', offers: [], diagnostics: ['e2e:not-found'] },
    })

    cy.visit('/purchases/new', {
      onBeforeLoad(win) {
        installSupabaseStub(win)
        win.localStorage.setItem(scopedKey(user), JSON.stringify(baseState()))
      },
    })

    cy.contains('button', 'Buscar por descricao').click()
    cy.get('textarea').type('lanterna tras ld punto')
    cy.contains('button', 'Procurar produto').click()
    cy.get('.review-panel input').first().should('have.value', 'lanterna traseira direita Fiat Punto')
    cy.contains('button', 'Salvar na wishlist').click()

    cy.location('pathname').should('eq', '/purchases')
    cy.contains('lanterna traseira direita Fiat Punto').should('exist')
    cy.window().then((win) => {
      expect(win.localStorage.getItem(STORAGE_KEY)).to.eq(null)
      const saved = JSON.parse(win.localStorage.getItem(scopedKey(user)))
      expect(saved.wishlist).to.have.length(1)
      expect(saved.wishlist[0].name).to.eq('lanterna traseira direita Fiat Punto')
      expect(saved.wishlist[0].description).to.eq('lanterna tras ld punto')
      expect(saved.wishlist[0].product_identity).to.include({
        product_type: 'auto_part',
        side: 'right',
        vehicle_make: 'Fiat',
        vehicle_model: 'Punto',
        match_policy: 'strict',
      })
    })
  })
})
