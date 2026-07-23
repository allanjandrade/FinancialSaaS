import { visitRelease10 } from './release10-helpers.js'

describe('Release 11 beta tester flow', () => {
  it('tester has beta features and no admin panel', () => {
    visitRelease10('/billing', { tester: true, usage: 3 })
    cy.get('[data-testid="app-sidebar"]').should('not.contain.text', 'Admin')
    cy.get('[data-testid="billing-checkout-button"]').should('not.be.disabled')
    cy.get('[data-testid="paywall-card"]').should('not.exist')
  })
})
