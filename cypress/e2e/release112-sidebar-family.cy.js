import { visitRelease10 } from './release10-helpers.js'

describe('Release 11.2 sidebar and family', () => {
  it('opens the simple family page from the authenticated app shell', () => {
    visitRelease10('/family')
    cy.get('[data-testid="family-page"]').should('exist')
    cy.get('[data-testid="family-member-form"]').should('contain.text', 'Nome')
    cy.get('[data-testid="family-member-form"]').should('contain.text', 'Rela')
    cy.get('[data-testid="app-sidebar"]').should('contain.text', 'Família')
    cy.get('[data-testid="app-sidebar"]').should('not.contain.text', 'Planos')
    cy.get('[data-testid="app-sidebar"]').should('not.contain.text', 'CF')
  })

  it('keeps sidebar layout contracts in source', () => {
    cy.readFile('src/components/Sidebar.vue').should('contain', '<AppLogo')
    cy.readFile('src/components/Sidebar.vue').should('contain', 'overflow-x: hidden')
    cy.readFile('src/components/Sidebar.vue').should('contain', 'sidebar-footer')
  })
})
