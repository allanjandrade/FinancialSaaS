import { financeState, visitRelease10 } from './release10-helpers.js'

function wishlistState(count = 2) {
  const base = financeState()
  const wishlist = [
    {
      id: 'notebook',
      name: 'Notebook para trabalho',
      value: 1800,
      category: 'Trabalho',
      priority: 'Alta',
      priceStatus: 'quoted',
      marketplace: 'Loja B2B',
      necessidade: 95,
      urgencia: 80,
      impactoPratico: 90,
      viabilidade: 65,
      risco: 30,
      preferencia: 60,
      marketplaceOffers: [{ total: 1800, marketplace: 'Loja B2B', compatibility_status: 'accepted' }],
    },
    {
      id: 'console',
      name: 'Console',
      value: 1200,
      category: 'Lazer',
      priority: 'Baixa',
      priceStatus: 'quoted',
      marketplace: 'Marketplace',
      necessidade: 30,
      urgencia: 35,
      impactoPratico: 30,
      viabilidade: 45,
      risco: 70,
      preferencia: 90,
      marketplaceOffers: [{ total: 1200, marketplace: 'Marketplace', compatibility_status: 'accepted' }],
    },
  ]

  while (wishlist.length < count) {
    wishlist.push({
      id: `extra-${wishlist.length}`,
      name: `Item extra ${wishlist.length}`,
      value: 300 + wishlist.length * 20,
      category: 'Outros',
      priority: 'Média',
      priceStatus: 'quoted',
    })
  }

  return {
    ...base,
    settings: {
      ...base.settings,
      monthlySavingsCapacity: 500,
    },
    financialAccounts: [{ id: 'account-1', name: 'Conta', balance: 1800 }],
    incomes: [{ id: 'income-1', date: '2026-06-05', type: 'Salario', amount: 2300 }],
    expenses: [{ id: 'expense-1', date: '2026-06-10', category: 'Moradia', amount: 500 }],
    wishlist,
  }
}

describe('Wishlist predictive ranking', () => {
  it('renders the analyst purchase ranking and action buttons', () => {
    visitRelease10('/purchases', { state: wishlistState() })

    cy.get('[data-testid="wishlist-predictive-ranking"]').should('be.visible')
    cy.contains('Ranking recomendado').should('be.visible')
    cy.contains('Notebook para trabalho').should('be.visible')
    cy.contains('Alto custo de oportunidade').should('be.visible')
    cy.contains('button', 'Simular Compra').should('be.visible')
    cy.contains('button', 'Comparar Item').should('be.visible')
  })

  it('respects the wishlist item permission limit', () => {
    visitRelease10('/purchases', {
      state: wishlistState(5),
      entitlements: {
        plan_code: 'free',
        is_tester: false,
        features: { wishlist_items: true, price_search: true },
        limits: { wishlist_items: 5, price_search_monthly: 3, automations_active: 1 },
      },
    })

    cy.get('[data-testid="wishlist-limit-banner"]').should('contain.text', 'Limite de 5 itens')
    cy.get('[data-testid="wishlist-add-disabled"]').should('be.disabled')
    cy.get('[data-testid="wishlist-add-link"]').should('not.exist')
  })
})
