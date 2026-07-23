const STORAGE_KEY = 'controle-financeiro-app-v2'
const userA = { id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', email: 'security-a@example.com' }
const userB = { id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', email: 'security-b@example.com' }

function scopedKey(user) {
  return `${STORAGE_KEY}:${user.id}`
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

function installSupabaseStub(win, user) {
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

function baseState(overrides = {}) {
  return {
    settings: { year: 2026, selectedMonth: 6, currentMemberId: 'member-1' },
    family: { id: 'family-security', name: 'Familia Security' },
    familyMembers: [{ id: 'member-1', name: 'Usuario Security', role: 'administrator' }],
    financialAccounts: [{ id: 'account-1', name: 'Conta principal', type: 'Conta Corrente', balance: 1000 }],
    creditCards: [],
    benefitWallets: [],
    incomes: [],
    expenses: [],
    wishlist: [],
    internalTransfers: [],
    ...overrides,
  }
}

function visitAs(user, path, state) {
  cy.visit(path, {
    onBeforeLoad(win) {
      installSupabaseStub(win, user)
      if (state) win.localStorage.setItem(scopedKey(user), JSON.stringify(state))
    },
  })
}

describe('P0 security user isolation', () => {
  it('does not leak entries, wishlist or cache when switching users in the same browser', () => {
    visitAs(userA, '/entries', baseState())
    cy.contains('button', 'Receita').click()
    cy.contains('label', 'Valor').find('input').clear().type('111.11')
    cy.contains('label', /Descri/).find('input').type('Receita secreta A')
    cy.contains('button', 'Salvar').click()
    cy.get('[data-testid="entries-history-list"]').should('contain.text', 'Receita')
    cy.window().then((win) => {
      const savedA = JSON.parse(win.localStorage.getItem(scopedKey(userA)))
      expect(savedA.incomes[0].description).to.eq('Receita secreta A')
    })

    cy.visit('/purchases/new', {
      onBeforeLoad(win) {
        installSupabaseStub(win, userA)
      },
    })
    cy.contains('button', 'Buscar por descricao').click()
    cy.get('textarea').type('Item secreto A')
    cy.contains('button', 'Procurar produto').click()
    cy.contains('button', 'Salvar na wishlist').click()
    cy.location('pathname').should('eq', '/purchases')
    cy.contains('Item secreto A').should('exist')

    cy.window().then((win) => {
      expect(win.localStorage.getItem(STORAGE_KEY)).to.eq(null)
      const savedA = JSON.parse(win.localStorage.getItem(scopedKey(userA)))
      expect(savedA.incomes[0].description).to.eq('Receita secreta A')
      expect(savedA.wishlist[0].name).to.eq('Item secreto A')
    })

    visitAs(userB, '/dashboard', baseState())
    cy.contains('Receita secreta A').should('not.exist')
    cy.contains('Item secreto A').should('not.exist')

    cy.visit('/entries', { onBeforeLoad: (win) => installSupabaseStub(win, userB) })
    cy.contains('Nenhum lançamento ainda').should('exist')
    cy.contains('Receita secreta A').should('not.exist')

    cy.visit('/purchases', { onBeforeLoad: (win) => installSupabaseStub(win, userB) })
    cy.contains('Nenhum produto salvo').should('exist')
    cy.contains('Item secreto A').should('not.exist')

    cy.reload()
    cy.contains('Item secreto A').should('not.exist')
  })
})
