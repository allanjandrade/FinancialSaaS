const STORAGE_KEY = 'controle-financeiro-app-v2'
const scopedStorageKey = (userId = '77777777-7777-4777-7777-777777777777') => `${STORAGE_KEY}:${userId}`

function installSupabaseStub(win) {
  const user = { id: '77777777-7777-4777-7777-777777777777', email: 'readiness@example.com' }
  const session = { access_token: 'e2e-token', user }
  win.SUPABASE_CONFIG = { url: 'https://example.supabase.co', anonKey: 'anon' }
  win.supabase = {
    auth: {
      getSession: async () => ({ data: { session }, error: null }),
      getUser: async () => ({ data: { user }, error: null }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
    },
    from: () => ({ select: () => ({ then: (resolve) => Promise.resolve({ data: [], error: null }).then(resolve) }) }),
    rpc: () => Promise.resolve({ data: null, error: null }),
    channel: () => ({ on: () => ({ subscribe: () => ({}) }) }),
    removeChannel: () => {},
    functions: { invoke: async () => ({ data: { ok: true }, error: null }) },
  }
}

describe('Release 8 P0 production readiness guardrails', () => {
  it('does not expose provider secrets in the browser runtime', () => {
    cy.visit('/dashboard', {
      onBeforeLoad(win) {
        installSupabaseStub(win)
        win.localStorage.clear()
        win.localStorage.setItem(scopedStorageKey(), JSON.stringify({
          settings: { year: 2026, selectedMonth: 6, currentMemberId: 'member-1' },
          familyMembers: [{ id: 'member-1', name: 'Usuario', role: 'administrator' }],
          financialAccounts: [],
          creditCards: [],
          benefitWallets: [],
          incomes: [],
          expenses: [],
          wishlist: [],
        }))
      },
    })

    cy.window().then((win) => {
      expect(win.VALUE_SERP_API_KEY).to.equal(undefined)
      expect(win.DATAFORSEO_LOGIN).to.equal(undefined)
      expect(win.SUPABASE_SERVICE_ROLE_KEY).to.equal(undefined)
      expect(win.SUPABASE_CONFIG.anonKey).to.be.a('string').and.not.equal('')
      expect(win.SUPABASE_CONFIG.anonKey).not.to.contain('service_role')
    })
    cy.contains('Visão Geral')
  })
})
