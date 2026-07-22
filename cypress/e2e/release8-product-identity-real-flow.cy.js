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

const rejected = [
  { title: 'Lanterna Traseira Siena Tampa Magneti Marelli', total: 110.25, compatibility_status: 'rejected', reason: 'Candidato contem veiculo conflitante: Siena.' },
  { title: 'Lanterna Traseira Hilux 2012/2015 Direita', total: 252.68, compatibility_status: 'rejected', reason: 'Candidato contem veiculo conflitante: Hilux.' },
  { title: 'Lanterna Fiat Palio Adventure', total: 229.77, compatibility_status: 'rejected', reason: 'Candidato contem veiculo conflitante: Palio.' },
]

function visitProduct(item) {
  cy.visit(`/compras-ia/produto/${item.id}`, {
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
        familyMembers: [{ id: 'member-1', name: 'Usuario Release 8.1', role: 'administrator' }],
        financialAccounts: [],
        creditCards: [],
        benefitWallets: [],
        incomes: [{ id: 'income-1', date: '2026-06-01', amount: 4000, type: 'Salario' }],
        expenses: [],
        wishlist: [item],
      }))
    },
  })
}

describe('Release 8.1 product identity real product screen flow', () => {
  it('shows only Fiat Punto compatible offer as valid price on desktop and mobile', () => {
    const accepted = {
      title: 'Lanterna Traseira Direita Fiat Punto 2008 2009',
      marketplace: 'Mercado Livre',
      price: 320,
      total: 320,
      compatibility_status: 'accepted',
      match_score: 0.94,
      match_reason: 'Contem lanterna traseira, lado direito e Punto.',
    }
    visitProduct({
      id: 'punto-compatible',
      name: 'lanterna tras ld punto',
      value: 320,
      category: 'Outros',
      priority: 'Media',
      product_identity: identity,
      price_search_status: 'found_compatible',
      last_match_score: 0.94,
      last_match_reason: accepted.match_reason,
      best_compatible_offer: accepted,
      marketplaceOffers: [accepted],
      last_rejected_candidates: [],
      priceStatus: 'quoted',
      priceHistory: [{
        at: '2026-06-19T12:00:00Z',
        price: 320,
        total: 320,
        marketplace: 'Mercado Livre',
        compatibility_status: 'accepted',
        match_score: 0.94,
        offers: [accepted],
      }],
    })

    cy.contains('Produto confirmado')
    cy.contains('Preco atual')
    cy.contains('R$ 320')
    cy.contains('Lanterna Traseira Direita Fiat Punto')
    cy.get('.history').should('not.contain.text', 'Siena')
    cy.get('.history').should('not.contain.text', 'Hilux')
    cy.get('.history').should('not.contain.text', 'Palio')
    cy.contains('Excelente oportunidade').should('not.exist')

    cy.viewport(390, 844)
    cy.window().then((win) => {
      expect(win.document.documentElement.scrollWidth).to.be.lte(win.innerWidth + 1)
    })
  })

  it('keeps price, history, intelligence and alert pending when Punto is absent', () => {
    visitProduct({
      id: 'punto-not-found',
      name: 'lanterna tras ld punto',
      value: null,
      category: 'Outros',
      priority: 'Media',
      product_identity: identity,
      price_search_status: 'not_found',
      last_match_score: 0,
      last_match_reason: 'Nenhum candidato atingiu compatibilidade minima.',
      best_compatible_offer: null,
      marketplaceOffers: [],
      last_rejected_candidates: [],
      priceStatus: 'pending_quote',
      priceHistory: [],
    })

    cy.contains('Nenhuma oferta compativel')
    cy.contains('Preco atual').parent().should('contain.text', 'Nao encontrado')
    cy.contains('Nenhum preco compativel encontrado ainda')
    cy.contains('Compatibilidade pendente')
    cy.contains('Ainda nao ha preco compativel suficiente para avaliar esta compra.')
    cy.contains('Excelente oportunidade').should('not.exist')
    cy.contains('Produto confirmado').should('not.exist')
  })

  it('does not show stale legacy Siena or Hilux history after compatibility failed', () => {
    visitProduct({
      id: 'legacy-punto-contaminated',
      name: 'lanterna tras ld punto',
      value: 110.25,
      category: 'Outros',
      priority: 'Media',
      product_identity: identity,
      price_search_status: 'not_found',
      last_match_score: 0,
      last_match_reason: 'Nenhum candidato atingiu compatibilidade minima.',
      best_compatible_offer: null,
      marketplaceOffers: [
        { title: 'Lanterna Traseira Siena Tampa Magneti Marelli', total: 110.25 },
      ],
      last_rejected_candidates: [],
      priceStatus: 'quoted',
      priceHistory: [{
        at: '2026-06-18T12:00:00Z',
        price: 110.25,
        total: 110.25,
        marketplace: 'Mercado Livre',
        offers: [
          { title: 'Lanterna Traseira Siena Tampa Magneti Marelli', total: 110.25 },
          { title: 'Lanterna Traseira Hilux 2012/2015 Direita', total: 252.68 },
        ],
      }],
    })

    cy.contains('Preco atual').parent().should('contain.text', 'Nao encontrado')
    cy.contains('Nenhum preco compativel encontrado ainda')
    cy.contains('Compatibilidade pendente')
    cy.contains('Ainda nao ha preco compativel suficiente para avaliar esta compra.')
    cy.contains('Nenhum preco compativel encontrado ainda')
    cy.contains('Lanterna Traseira Siena Tampa Magneti Marelli').should('not.exist')
    cy.contains('Lanterna Traseira Hilux').should('not.exist')
    cy.contains('Excelente oportunidade').should('not.exist')
  })
})
