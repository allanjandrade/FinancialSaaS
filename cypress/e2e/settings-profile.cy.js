import { visitRelease10 } from './release10-helpers.js'

describe('Release 11 settings profile', () => {
  it('shows precise annual plan and support link', () => {
    visitRelease10('/settings', {
      subscription: { status: 'active', plan_code: 'premium_annual' },
    })
    cy.get('[data-testid="settings-nav"]').contains('Assinatura').click()
    cy.get('[data-testid="settings-page"]').should('contain.text', 'Plano atual: Premium anual')
    cy.get('[data-testid="settings-nav"]').contains('Suporte').click()
    cy.get('[data-testid="settings-page"]').contains('Abrir suporte').click()
    cy.location('pathname').should('eq', '/support')
  })
})
