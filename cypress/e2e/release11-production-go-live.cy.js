import { visitRelease10 } from './release10-helpers.js'

describe('Release 11 production go-live', () => {
  it('keeps admin and operational menus compatible with account type', () => {
    visitRelease10('/dashboard')
    cy.get('[data-testid="app-sidebar"]').should('not.contain.text', 'Admin')
    cy.get('[data-testid="app-sidebar"]').should('not.contain.text', 'Operacional')

    visitRelease10('/dashboard', { admin: 'support' })
    cy.get('[data-testid="app-sidebar"]').should('contain.text', 'Admin')
    cy.get('[data-testid="app-sidebar"]').should('not.contain.text', 'Operacional')

    visitRelease10('/dashboard', { admin: 'owner' })
    cy.get('[data-testid="app-sidebar"]').should('contain.text', 'Admin')
    cy.get('[data-testid="app-sidebar"]').should('contain.text', 'Operacional')
  })
})
