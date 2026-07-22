import { visitRelease10 } from './release10-helpers.js'

describe('Release 11 menu architecture', () => {
  it('does not expose duplicate purchase simulator or AI history entries', () => {
    visitRelease10('/dashboard', { subscription: { status: 'active', plan_code: 'premium_monthly' } })
    cy.get('.nav-toggle').click()
    cy.get('[data-testid="app-sidebar"] a[href="/entries"]').should('exist')
    cy.get('[data-testid="app-sidebar"] a[href="/structure?tab=accounts"]').should('exist')
    cy.get('[data-testid="app-sidebar"] a[href="/plan"]').should('exist')
    cy.get('[data-testid="app-sidebar"] a[href="/purchases"]').should('exist')
    cy.get('[data-testid="app-sidebar"] a[href="/advisor"]').should('exist')
    cy.get('[data-testid="app-sidebar"] a[href="/simulations"]').should('not.exist')
    cy.get('[data-testid="app-sidebar"] a[href="/ai-actions"]').should('not.exist')
    cy.get('[data-testid="app-sidebar"] a[href="/automations"]').should('not.exist')
    cy.get('[data-testid="app-sidebar"]').should('not.contain.text', 'Posso comprar?')
    cy.get('[data-testid="app-sidebar"]').should('not.contain.text', 'Historico de acoes')
  })
})
