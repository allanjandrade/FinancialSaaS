describe('Release 11.2 reset password', () => {
  it('renders the reset route and keeps recovery-token handling in the helper', () => {
    cy.visit('/reset-password#access_token=demo&refresh_token=demo&type=recovery')
    cy.get('[data-testid="reset-password-page"]').should('exist')
    cy.contains('Criar nova senha').should('exist')
    cy.contains('Nova senha').should('exist')
    cy.contains('Confirmar nova senha').should('exist')

    cy.readFile('src/domain/auth/passwordReset.js').then((source) => {
      expect(source).to.contain('setSession')
      expect(source).to.contain('replaceState')
      expect(source).not.to.match(/console\.log|localStorage|sessionStorage/)
    })
  })
})
