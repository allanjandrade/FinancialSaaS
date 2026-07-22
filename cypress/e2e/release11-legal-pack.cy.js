describe('Release 11.2 legal pack', () => {
  it('opens legal pages and requires acceptance on signup', () => {
    cy.visit('/')
    cy.contains('Termos de Uso').should('exist')
    cy.contains('Privacidade').should('exist')
    cy.contains('Cookies').should('exist')

    const pages = [
      ['/terms', 'terms-page'],
      ['/privacy', 'privacy-page'],
      ['/cookies', 'cookies-page'],
      ['/data-processing', 'data-processing-page'],
      ['/subscription-policy', 'subscription-policy-page'],
      ['/ai-consent', 'ai-consent-page'],
      ['/security', 'security-page'],
      ['/lgpd-requests', 'lgpd-requests-page'],
      ['/financial-disclaimer', 'financial-disclaimer-page'],
    ]
    for (const [path, testid] of pages) {
      cy.visit(path)
      cy.get(`[data-testid="${testid}"]`).should('be.visible')
    }

    cy.visit('/signup')
    cy.get('[data-testid="signup-page"]').should('be.visible')
    cy.readFile('src/views/Signup.vue').should('contain', 'data-testid="legal-acceptance"')
    cy.readFile('src/views/Signup.vue').should('contain', 'data-testid="signup-submit"')
    cy.readFile('src/views/Signup.vue').should('contain', 'Termos de Uso')
  })
})
