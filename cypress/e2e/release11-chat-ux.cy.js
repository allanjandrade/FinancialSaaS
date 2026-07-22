import { visitRelease10 } from './release10-helpers.js'

describe('Release 11 chat UX', () => {
  it('shows a centered copiloto with cold-start suggestions', () => {
    visitRelease10('/ai')
    cy.contains('Copiloto financeiro').should('exist')
    cy.get('[data-testid="chat-suggestion-cards"]').should('contain.text', 'Resumo dos gastos do mês')
    cy.get('[data-testid="chat-suggestion-cards"]').should('contain.text', 'Quanto posso gastar esta semana?')
    cy.get('.ai-panel').invoke('outerWidth').should('be.lte', 820)
  })
})
