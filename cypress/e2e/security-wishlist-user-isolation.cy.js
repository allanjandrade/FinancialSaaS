const STORAGE_KEY = 'controle-financeiro-app-v2'
const userA = { id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', email: 'wishlist-a@example.com' }
const userB = { id: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd', email: 'wishlist-b@example.com' }

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

function stateWithWishlist(name, id = crypto.randomUUID()) {
  return {
    settings: { year: 2026, selectedMonth: 6, currentMemberId: 'member-1' },
    family: { id: 'family-wishlist', name: 'Familia Wishlist' },
    familyMembers: [{ id: 'member-1', name: 'Usuario Wishlist', role: 'administrator' }],
    financialAccounts: [],
    creditCards: [],
    benefitWallets: [],
    incomes: [],
    expenses: [],
    wishlist: [{ id, name, priceStatus: 'pending_quote', category: 'Outros' }],
    internalTransfers: [],
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

describe('P0 wishlist user isolation', () => {
  it('isolates new purchase, direct detail route and delete action by logged user', () => {
    const itemAId = 'item-secret-a'
    visitAs(userA, '/purchases', stateWithWishlist('Item secreto A', itemAId))
    cy.contains('Item secreto A').should('exist')

    visitAs(userB, '/purchases', stateWithWishlist('Item B', 'item-b'))
    cy.contains('Item B').should('exist')
    cy.contains('Item secreto A').should('not.exist')

    cy.visit(`/purchases/${itemAId}`, { onBeforeLoad: (win) => installSupabaseStub(win, userB) })
    cy.contains('Produto nao encontrado').should('exist')
    cy.contains('Item secreto A').should('not.exist')

    visitAs(userA, '/purchases', stateWithWishlist('Item secreto A', itemAId))
    cy.contains('Item secreto A').should('exist')
    cy.on('window:confirm', () => true)
    cy.contains('button', 'Excluir').click()
    cy.contains('Item excluído da sua wishlist.').should('exist')
    cy.contains('Item secreto A').should('not.exist')

    cy.window().then((win) => {
      const savedA = JSON.parse(win.localStorage.getItem(scopedKey(userA)))
      expect(savedA.wishlist).to.have.length(0)
      const savedB = JSON.parse(win.localStorage.getItem(scopedKey(userB)))
      expect(savedB.wishlist[0].name).to.eq('Item B')
    })
  })
})
