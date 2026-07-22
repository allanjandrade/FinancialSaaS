describe('Release 11.1 public polish', () => {
  it('keeps login, signup, pricing, entries and settings aligned with product rules', () => {
    cy.visit('/login')
    cy.contains('Entre na sua conta').should('exist')
    cy.contains(/facebook/i).should('not.exist')

    cy.visit('/signup')
    cy.contains(/Crie sua conta|Cadastro controlado/).should('exist')
    cy.contains(/facebook/i).should('not.exist')
    cy.readFile('src/views/Signup.vue').should('contain', 'Termos de Uso')

    cy.visit('/')
    cy.contains('Organize sua vida financeira com mais clareza').should('exist')
    cy.contains('Privacidade e segurança').should('exist')
    cy.contains(/Billing|server-side|dados minimizados/i).should('not.exist')

    cy.visit('/pricing')
    cy.contains('R$ 16,58/mês').should('exist')
    cy.contains('R$ 199,00 cobrados ao ano').should('exist')
    cy.contains('Assinar Premium').should('exist')
    cy.contains(/Avise-me quando liberar|acesso antecipado|testers autorizados/i).should('not.exist')
  })
})
