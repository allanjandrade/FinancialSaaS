import { visitRelease10 } from './release10-helpers.js'

describe('Release 11 support FAQ', () => {
  it('shows fixed FAQ and answers from support base only', () => {
    visitRelease10('/support')
    cy.get('[data-testid="support-page"]').should('contain.text', 'Suporte')
    cy.get('[data-testid="support-faq-list"] details').should('have.length', 10)
    cy.get('[data-testid="support-fixed-agent"]').find('input').type('senha')
    cy.get('[data-testid="support-fixed-agent"]').contains('Perguntar').click()
    cy.get('[data-testid="support-fixed-agent"]').should('contain.text', 'Esqueci minha senha')
  })
})
