import { visitRelease10 } from './release10-helpers.js'

describe('Release 11 sidebar plan access', () => {
  it('shows Premium consultant locked for Free accounts and redirects to billing', () => {
    visitRelease10('/dashboard')
    cy.get('.nav-toggle').click()
    cy.get('[data-testid="app-sidebar"] a[href*="feature=predictive_advisor"]').should('contain.text', 'Premium').click()
    cy.location('pathname').should('eq', '/billing')
    cy.get('[data-testid="locked-feature-message"]').should('contain.text', 'Premium')
  })

  it('lets Premium accounts open the consultant and legacy simulations', () => {
    const premium = { subscription: { status: 'active', plan_code: 'premium_monthly' } }
    visitRelease10('/advisor', premium)
    cy.get('[data-testid="advisor-page"]').should('exist')

    visitRelease10('/simulations', premium)
    cy.get('[data-testid="simulations-page"]').should('exist')
    cy.get('[data-testid="simulation-can-i-buy"]').click()
    cy.location('pathname').should('eq', '/simulations/can-i-buy')
    cy.get('[data-testid="purchase-simulator-page"]').should('contain.text', 'Posso comprar?')
  })
})
