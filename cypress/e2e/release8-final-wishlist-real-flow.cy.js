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

const identity = {
  original_text: 'lanterna tras ld punto',
  normalized_text: 'lanterna traseira lado direito fiat punto',
  product_type: 'auto_part',
  part_name: 'lanterna traseira',
  side: 'right',
  vehicle_make: 'Fiat',
  vehicle_model: 'Punto',
  must_match_terms: ['lanterna', 'traseira', 'punto', 'direita'],
  negative_terms: ['palio', 'siena', 'hilux'],
  match_policy: 'strict',
  side_required: true,
}

const accepted = {
  title: 'Lanterna Traseira Direita Fiat Punto 2008 2009',
  marketplace: 'Mercado Livre',
  price: 320,
  total: 320,
  compatibility_status: 'accepted',
  match_score: 0.94,
  match_reason: 'Contem lanterna traseira, lado direito e Punto.',
}

const rejected = [
  { title: 'Lanterna Traseira Siena Tampa Magneti Marelli', total: 110.25, price: 110.25, compatibility_status: 'rejected', match_score: 0, match_reason: 'Candidato contem veiculo conflitante: Siena.' },
  { title: 'Lanterna Traseira Hilux 2012/2015 Direita', total: 252.68, price: 252.68, compatibility_status: 'rejected', match_score: 0, match_reason: 'Candidato contem veiculo conflitante: Hilux.' },
  { title: 'Lanterna Mala Direito Grand Siena', total: 209.61, price: 209.61, compatibility_status: 'rejected', match_score: 0, match_reason: 'Candidato contem veiculo conflitante: Siena.' },
  { title: 'Magneti Marelli Lanterna Fiat Palio Weekend', total: 213.21, price: 213.21, compatibility_status: 'rejected', match_score: 0, match_reason: 'Candidato contem veiculo conflitante: Palio.' },
  { title: 'Lanterna Fiat Palio Adventure', total: 229.77, price: 229.77, compatibility_status: 'rejected', match_score: 0, match_reason: 'Candidato contem veiculo conflitante: Palio.' },
]

function installSupabaseStub(win) {
  const user = { id: '88888888-8888-4888-8888-888888888888', email: 'release8-final@example.com' }
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
}

function baseItem(overrides = {}) {
  return {
    id: 'punto-final',
    name: 'lanterna tras ld punto',
    value: null,
    category: 'Outros',
    priority: 'Media',
    product_identity: identity,
    price_search_status: 'quote_pending',
    priceStatus: 'pending_quote',
    best_compatible_offer: null,
    marketplaceOffers: [],
    accepted_candidates: [],
    last_rejected_candidates: [],
    priceHistory: [],
    ...overrides,
  }
}

function visitProduct(item = baseItem(), viewport = [1366, 768]) {
  cy.viewport(viewport[0], viewport[1])
  cy.visit(`/purchases/${item.id}`, {
    onBeforeLoad(win) {
      installSupabaseStub(win)
      win.localStorage.setItem(scopedStorageKey(), JSON.stringify({
        settings: { year: 2026, selectedMonth: 6, currentMemberId: 'member-1' },
        familyMembers: [{ id: 'member-1', name: 'Usuario Release 8 Final', role: 'administrator' }],
        financialAccounts: [{ id: 'account-1', name: 'Conta', type: 'Conta Corrente', balance: 6000 }],
        creditCards: [],
        benefitWallets: [],
        incomes: [{ id: 'income-1', date: '2026-06-01', amount: 6000, type: 'Salario' }],
        expenses: [],
        wishlist: [item],
      }))
    },
  })
}

describe('Release 8 final wishlist real flow', () => {
  it('accepts only Punto from mixed candidates and keeps rejected products separated', () => {
    cy.intercept('POST', '**/functions/v1/price-search', {
      statusCode: 200,
      body: {
        status: 'found_compatible',
        provider: 'valueserp_google_shopping',
        product_identity: identity,
        best_compatible_offer: accepted,
        accepted_candidates: [accepted],
        offers: [accepted],
        rejected_candidates: rejected,
        rejected,
        ambiguous_candidates: [],
        score: 0.94,
        reason: accepted.match_reason,
      },
    }).as('priceSearch')

    visitProduct()
    cy.contains('button', 'Atualizar precos').click()
    cy.wait('@priceSearch')

    cy.contains('Ofertas compativeis')
    cy.contains('Preco atual').parent().invoke('text').should('match', /R\$\s*320,00/)
    cy.contains('Lanterna Traseira Direita Fiat Punto 2008 2009')
    cy.contains('Excelente oportunidade').should('not.exist')
    cy.get('.history').should('contain.text', 'Punto')
    cy.get('.history').should('not.contain.text', 'Siena')
    cy.get('.history').should('not.contain.text', 'Hilux')
    cy.get('.history').should('not.contain.text', 'Palio')
    cy.contains('button', 'Ver rejeitados').click()
    for (const label of ['Siena', 'Hilux', 'Grand Siena', 'Palio Weekend', 'Palio Adventure']) {
      cy.contains(label).should('exist')
    }
  })

  it('keeps financial intelligence pending when no compatible product exists', () => {
    visitProduct(baseItem({
      price_search_status: 'not_found',
      last_rejected_candidates: rejected.slice(0, 4),
    }), [390, 844])

    cy.contains('Preco atual').parent().should('contain.text', 'Nao encontrado')
    cy.contains('Nenhuma oferta compativel')
    cy.contains('Nenhum preco compativel encontrado ainda')
    cy.contains('Excelente oportunidade').should('not.exist')
    cy.contains('Ofertas compativeis').should('exist')
    cy.window().then((win) => {
      expect(win.document.documentElement.scrollWidth).to.be.lte(win.innerWidth + 1)
    })
  })
})
