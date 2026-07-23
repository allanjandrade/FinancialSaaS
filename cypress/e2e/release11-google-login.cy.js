describe('Release 11 Google login', () => {
  it('hides Google divider when Google auth is disabled in this build', () => {
    cy.visit('/login')
    cy.get('[data-testid="login-page"]').should('exist')
    cy.get('body').then(($body) => {
      if ($body.find('[data-testid="google-login-button"]').length) {
        cy.get('[data-testid="google-login-button"]').should('contain.text', 'Continuar com Google')
        cy.contains('ou entre com e-mail').should('exist')
      } else {
        cy.contains('ou entre com e-mail').should('not.exist')
      }
    })
  })

  it('keeps enabled-state contract in source', () => {
    cy.readFile('src/views/Login.vue').should('contain', '<GoogleLoginButton v-if="googleAuthEnabled"')
    cy.readFile('src/views/Signup.vue').should('contain', '<GoogleLoginButton v-if="googleAuthEnabled"')
    cy.readFile('src/domain/auth/googleAuth.js').should('contain', 'Este e-mail não tem permissão para criar conta neste ambiente.')
  })
})
