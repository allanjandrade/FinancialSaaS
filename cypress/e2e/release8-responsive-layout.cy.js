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

function state() {
  return {
    settings: { year: 2026, selectedMonth: 6, currentMemberId: 'member-1' },
    familyMembers: [{ id: 'member-1', name: 'Usuario Release 8', role: 'administrator' }],
    financialAccounts: [{ id: 'account-1', name: 'Conta', type: 'Conta Corrente', balance: 5000 }],
    creditCards: [{ id: 'card-1', name: 'Cartao', limit: 8000, availableLimit: 7600, closingDay: 20, dueDay: 8 }],
    benefitWallets: [],
    incomes: [{ id: 'i1', date: '2026-06-05', type: 'Salario', amount: 5200 }],
    expenses: [{ id: 'e1', date: '2026-06-10', category: 'Mercado', payment: 'Pix', amount: 760 }],
    wishlist: [],
    planningGoals: [],
    categoryBudgets: [],
  }
}

function visitApp(path) {
  cy.viewport(390, 844)
  cy.visit(path, {
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
      win.localStorage.setItem(scopedStorageKey(), JSON.stringify(state()))
    },
  })
}

function expectNoOverflow() {
  cy.window().then((win) => {
    expect(win.document.documentElement.scrollWidth).to.be.lte(win.innerWidth + 1)
    ;[...win.document.querySelectorAll('main, section, article, form')].forEach((el) => {
      expect(el.getBoundingClientRect().right).to.be.lte(win.innerWidth + 1)
    })
  })
}

describe('Release 8 responsive layout', () => {
  for (const path of ['/dashboard', '/entries', '/reports', '/plan', '/goals', '/budget', '/purchase-simulator']) {
    it(`keeps ${path} without horizontal overflow at 390px`, () => {
      visitApp(path)
      expectNoOverflow()
    })
  }
})
