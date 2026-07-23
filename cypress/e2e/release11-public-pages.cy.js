describe('Release 11 public pages', () => {
  it('opens landing, login, signup, privacy, terms and pricing', () => {
    const pages = [
      ['/', 'landing-page', 'Organize sua vida financeira'],
      ['/login', 'login-page', 'Entrar'],
      ['/signup', 'signup-page', 'Cadastro'],
      ['/privacy', 'privacy-page', 'Política de Privacidade'],
      ['/terms', 'terms-page', 'Termos de Uso'],
      ['/pricing', 'pricing-page', 'Planos'],
    ]

    for (const [path, testId, text] of pages) {
      cy.visit(path)
      cy.get(`[data-testid="${testId}"]`).should('contain.text', text)
      cy.viewport(390, 844)
      cy.window().then((win) => {
        expect(win.document.documentElement.scrollWidth).to.be.lte(win.innerWidth + 1)
      })
    }
  })
})
