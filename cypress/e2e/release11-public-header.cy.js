describe('Release 11 public header', () => {
  it('keeps public navigation stable on small screens', () => {
    for (const viewport of [[360, 740], [390, 844], [412, 915]]) {
      cy.viewport(viewport[0], viewport[1])
      cy.visit('/')
      cy.get('[data-testid="public-header"]').should('contain.text', 'Controle Financeiro')
      cy.get('[data-testid="public-header"]').should('contain.text', 'Planos').and('contain.text', 'Entrar').and('contain.text', 'Criar conta')
      cy.window().then((win) => {
        expect(win.document.documentElement.scrollWidth).to.be.lte(win.innerWidth + 1)
      })
    }
  })
})
