describe('Release 11.2 production copy', () => {
  it('does not show beta/waitlist/tester language on public pricing', () => {
    cy.visit('/pricing')
    cy.contains('Grátis').should('exist')
    cy.contains('Premium mensal').should('exist')
    cy.contains('Premium anual').should('exist')
    cy.contains('R$ 19,90/mês').should('exist')
    cy.contains('R$ 16,58/mês').should('exist')
    cy.contains(/acesso antecipado|testers autorizados|Avise-me quando liberar|ainda não liberado/i).should('not.exist')
  })
})
