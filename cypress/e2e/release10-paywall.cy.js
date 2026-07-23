import { visitRelease10 } from './release10-helpers.js'

describe('Release 10 paywall', () => {
  it('appears after the free limit and does not block existing data access', () => {
    visitRelease10('/billing', { usage: 3 })
    cy.get('[data-testid="usage-limit-banner"]').should('contain.text', '3/3')
    cy.get('[data-testid="paywall-card"]').should('contain.text', 'Você atingiu o limite do plano grátis.')
    cy.contains('Planos e assinatura').should('exist')
  })
})
