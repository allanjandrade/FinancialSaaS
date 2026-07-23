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

function visitPlan() {
  cy.visit('/plan', {
    onBeforeLoad(win) {
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
      win.localStorage.setItem(scopedStorageKey(), JSON.stringify({
        settings: { year: 2026, selectedMonth: 6, currentMemberId: 'member-1' },
        familyMembers: [{ id: 'member-1', name: 'Usuario Release 8', role: 'administrator' }],
        financialAccounts: [],
        creditCards: [],
        benefitWallets: [],
        incomes: [],
        expenses: [],
        wishlist: [],
      }))
    },
  })
}

describe('Release 8 product identity in wishlist', () => {
  it('shows only compatible Fiat Punto right rear light as best compatible price', () => {
    visitPlan()
    cy.get('[data-testid="wishlist-text"]').clear().type('lanterna tras ld punto')
    cy.get('[data-testid="wishlist-target"]').clear().type('350')
    cy.get('[data-testid="wishlist-review"]').click()
    cy.get('[data-testid="identity-review"]').should('contain.text', 'Fiat Punto')
    cy.get('[data-testid="identity-confirm"]').click()
    cy.get('[data-testid="mock-candidates"]').click()
    cy.get('[data-testid="wishlist-row"]').should('contain.text', 'compativel')
    cy.window().then((win) => {
      const item = JSON.parse(win.localStorage.getItem(scopedStorageKey())).wishlist[0]
      expect(item.value).to.equal(320)
      expect(item.price_search_status).to.equal('found_compatible')
      const rejected = item.last_rejected_candidates.map((row) => row.title).join(' ')
      expect(rejected).to.include('Palio')
      expect(rejected).to.include('Siena')
      expect(rejected).to.include('Hilux')
    })
  })
})
