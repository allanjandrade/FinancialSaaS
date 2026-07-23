import { visitRelease10 } from './release10-helpers.js'

describe('Release 10 plan comparison', () => {
  it('shows free, monthly premium and annual premium on desktop and mobile', () => {
    visitRelease10('/billing', { usage: 1 })
    cy.get('[data-testid="plan-comparison"]').should('contain.text', 'Grátis')
    cy.get('[data-testid="plan-comparison"]').should('contain.text', 'Premium mensal')
    cy.get('[data-testid="plan-comparison"]').should('contain.text', 'Premium anual')
    cy.viewport(390, 844)
    cy.window().then((win) => {
      expect(win.document.documentElement.scrollWidth).to.be.lte(win.innerWidth + 1)
    })
  })
})
