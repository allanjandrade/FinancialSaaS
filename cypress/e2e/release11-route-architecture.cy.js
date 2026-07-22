import { visitRelease10 } from './release10-helpers.js'

describe('Release 11 route architecture', () => {
  it('opens AI actions as an intelligence hub, not as new purchase', () => {
    visitRelease10('/ai-actions', { subscription: { status: 'active', plan_code: 'premium_monthly' } })
    cy.get('[data-testid="ai-actions-hub"]').should('contain.text', 'Inteligência financeira')
    cy.get('[data-testid="hub-consultar-mes"]').should('exist')
    cy.get('[data-testid="hub-buscar-produto"]').should('exist')
    cy.get('[data-testid="ai-actions-hub"]').should('not.contain.text', 'Salvar sem buscar')
  })

  it('keeps new purchase focused on product registration', () => {
    visitRelease10('/purchases/new?mode=text')
    cy.contains('Nova compra').should('exist')
    cy.contains('Descreva o produto').should('exist')
    cy.contains('Procurar produto').should('exist')
    cy.contains('Salvar sem buscar').should('exist')
    cy.contains('Consultar meu mês').should('not.exist')
  })
})
