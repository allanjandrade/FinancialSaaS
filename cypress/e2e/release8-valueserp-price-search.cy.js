const STORAGE_KEY = 'controle-financeiro-app-v2'
const scopedStorageKey = (userId = '99999999-9999-4999-9999-999999999999') => `${STORAGE_KEY}:${userId}`

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
  const user = { id: '99999999-9999-4999-9999-999999999999', email: 'valueserp@example.com' }
  const session = { access_token: 'e2e-token', user }
  win.SUPABASE_CONFIG = { url: 'https://example.supabase.co', anonKey: 'anon' }
  win.supabase = {
    auth: {
      getSession: async () => ({ data: { session }, error: null }),
      getUser: async () => ({ data: { user }, error: null }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
    },
    from: () => queryResult(null),
    rpc: () => Promise.resolve({ data: null, error: null }),
    channel: () => ({ on: () => ({ subscribe: () => ({}) }) }),
    removeChannel: () => {},
    functions: { invoke: async () => ({ data: null, error: null }) },
  }
}

function visitProduct(wishlist) {
  cy.viewport(1366, 768)
  cy.visit('/purchases/punto-light', {
    onBeforeLoad(win) {
      installSupabaseStub(win)
      win.localStorage.clear()
      win.localStorage.setItem(scopedStorageKey(), JSON.stringify({
        settings: { year: 2026, selectedMonth: 6, currentMemberId: 'member-1' },
        familyMembers: [{ id: 'member-1', name: 'Usuario', role: 'administrator' }],
        financialAccounts: [{ id: 'account-1', name: 'Conta', type: 'Conta Corrente', balance: 5000 }],
        creditCards: [],
        benefitWallets: [],
        incomes: [],
        expenses: [],
        wishlist,
      }))
    },
  })
}

describe('Release 8 P0 ValueSERP compatible price', () => {
  it('does not promote rejected cheaper candidates as current or best price', () => {
    visitProduct([{
      id: 'punto-light',
      name: 'lanterna tras ld punto',
      category: 'Autopecas',
      price_search_status: 'not_found',
      product_identity: {
        match_policy: 'strict',
        product_type: 'auto_part',
        part_name: 'lanterna traseira',
        side: 'right',
        vehicle_make: 'Fiat',
        vehicle_model: 'Punto',
        side_required: true,
      },
      best_compatible_offer: null,
      marketplaceOffers: [],
      priceHistory: [],
      last_rejected_candidates: [
        { title: 'Lanterna Traseira Siena Tampa Magneti Marelli', total: 110.25, reason: 'Candidato contem veiculo conflitante: Siena.' },
        { title: 'Lanterna Traseira Hilux 2012/2015 Direita', total: 252.68, reason: 'Candidato contem veiculo conflitante: Hilux.' },
      ],
    }])

    cy.contains('Preco atual').parent().should('contain.text', 'Nao encontrado')
    cy.contains('Nenhuma oferta compativel')
    cy.contains('Ainda nao encontramos uma oferta compativel para este produto')
    cy.contains('Excelente oportunidade').should('not.exist')
    cy.contains('button', 'Ver rejeitados').click()
    cy.contains('Lanterna Traseira Siena Tampa Magneti Marelli')
    cy.contains('Lanterna Traseira Hilux 2012/2015 Direita')
  })
})
