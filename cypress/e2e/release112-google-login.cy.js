describe('Release 11.2 Google login', () => {
  it('keeps Google behind the flag and uses closed-environment copy', () => {
    cy.readFile('src/views/Login.vue').should('contain', '<GoogleLoginButton v-if="googleAuthEnabled"')
    cy.readFile('src/views/Signup.vue').should('contain', '<GoogleLoginButton v-if="googleAuthEnabled"')
    cy.readFile('src/domain/auth/googleAuth.js').should('contain', 'Este e-mail não tem permissão para criar conta neste ambiente.')
    cy.readFile('src/views/AuthCallback.vue').should('contain', 'E-mail não autorizado')
  })
})
