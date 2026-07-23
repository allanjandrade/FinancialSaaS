import { installSupabaseStub, scopedStorageKey, visitRelease10 } from './release10-helpers.js'

const wishlistState = {
  settings: { year: 2026, selectedMonth: 6, currentMemberId: 'member-1' },
  familyMembers: [{ id: 'member-1', name: 'Wishlist QA', role: 'administrator' }],
  financialAccounts: [{ id: 'account-1', name: 'Conta', type: 'Conta Corrente', balance: 5000 }],
  creditCards: [{ id: 'card-1', name: 'Cartao', limit: 3000, openBill: 450, closingDay: 20, dueDay: 8 }],
  benefitWallets: [],
  incomes: [{ id: 'income-1', date: '2026-06-05', type: 'Salario', amount: 5000 }],
  expenses: [
    { id: 'expense-1', date: '2026-06-10', category: 'Moradia', payment: 'Pix', amount: 1700, paid: true },
    { id: 'expense-2', date: '2026-06-12', category: 'Cartao', payment: 'Credito', amount: 450, paid: false },
  ],
  wishlist: [],
  internalTransfers: [],
}

function savedState(userId) {
  return cy.window().then((win) => JSON.parse(win.localStorage.getItem(scopedStorageKey(userId)) || '{}'))
}

function visitReturningUser(path, userId, email) {
  cy.visit(path, {
    onBeforeLoad(win) {
      installSupabaseStub(win, { userId, email })
    },
  })
}

describe('Release 11.2 wishlist functional flow', () => {
  it('persists a manually created item without price as quote pending across reload and login', () => {
    const userId = '12121212-1212-4212-8212-121212121212'
    visitRelease10('/purchases/new', { state: wishlistState, userId, email: 'wishlist-pending@example.com' })

    cy.get('textarea').type('Mesa dobravel escritorio')
    cy.contains('button', 'Salvar sem buscar').click()

    cy.location('pathname').should('eq', '/purchases')
    cy.contains('Mesa dobravel escritorio').should('be.visible')
    cy.contains('Cotacao pendente').should('be.visible')
    cy.get('main').should('not.contain.text', 'R$ 0,00')
    savedState(userId).then((state) => {
      expect(state.wishlist).to.have.length(1)
      expect(state.wishlist[0]).to.include({
        name: 'Mesa dobravel escritorio',
        priceStatus: 'pending_quote',
      })
      expect(state.wishlist[0].value).to.equal(null)
    })

    visitReturningUser('/purchases', userId, 'wishlist-pending@example.com')
    cy.contains('Mesa dobravel escritorio').should('be.visible')
    cy.get('main').should('not.contain.text', 'R$ 0,00')

    visitReturningUser('/purchases', userId, 'wishlist-pending@example.com')
    cy.contains('Mesa dobravel escritorio').should('be.visible')
    cy.contains('Cotacao pendente').should('be.visible')
  })

  it('saves a manual price and answers the purchase decision with financial impact', () => {
    const userId = '34343434-3434-4434-8434-343434343434'
    visitRelease10('/purchases', {
      state: {
        ...wishlistState,
        wishlist: [{
          id: 'wish-chair',
          name: 'Cadeira ergonomica',
          value: null,
          category: 'Outros',
          priority: 'Alta',
          priceStatus: 'pending_quote',
          price_search_status: 'quote_pending',
          priceHistory: [],
          marketplaceOffers: [],
        }],
      },
      userId,
      email: 'wishlist-manual@example.com',
    })

    cy.contains('.wish-card', 'Cadeira ergonomica').within(() => {
      cy.get('.manual-price input').clear().type('600')
      cy.contains('button', 'Salvar preço').click()
    })
    cy.contains('Preço manual salvo').should('be.visible')
    cy.get('main').should('not.contain.text', 'R$ 0,00')
    savedState(userId).then((state) => {
      const item = state.wishlist.find((entry) => entry.id === 'wish-chair')
      expect(item.value).to.equal(600)
      expect(item.manualPrice).to.equal(true)
      expect(item.priceHistory[0].source).to.equal('manual')
    })

    cy.contains('[data-testid="wishlist-predictive-ranking"] article', 'Cadeira ergonomica').within(() => {
      cy.contains('button', 'Simular Compra').click()
    })
    cy.get('[data-testid="wishlist-purchase-decision"]').should('be.visible')
    cy.get('[data-testid="wishlist-purchase-decision"]').should('contain.text', 'Posso comprar?')
    cy.get('[data-testid="wishlist-purchase-decision"]').invoke('text').should('match', /R\$\s*600,00/)
    cy.get('[data-testid="wishlist-purchase-decision"]').should('contain.text', 'Não salva automaticamente')
  })

  it('redirects legacy compras routes without 404 or 500', () => {
    visitRelease10('/compras/nova', { state: wishlistState })
    cy.location('pathname').should('eq', '/purchases/new')
    cy.contains('Nova compra').should('be.visible')

    visitRelease10('/compras/produto/wish-legacy', {
      state: {
        ...wishlistState,
        wishlist: [{
          id: 'wish-legacy',
          name: 'Produto legado',
          value: 250,
          category: 'Outros',
          priority: 'Media',
          priceStatus: 'quoted',
          price_search_status: 'found_compatible',
        }],
      },
    })
    cy.location('pathname').should('eq', '/purchases/wish-legacy')
    cy.contains('Produto legado').should('be.visible')
  })
})
