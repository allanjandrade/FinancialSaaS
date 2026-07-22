import { visitRelease10 } from './release10-helpers.js'

describe('Release 11 billing guard', () => {
  it('blocks common checkout and allows tester checkout in testers_only mode', () => {
    visitRelease10('/billing', { usage: 1 })
    cy.get('[data-testid="billing-checkout-button"]').should('be.disabled')
    cy.get('[data-testid="billing-guard-message"]').should('contain.text', 'Upgrade Premium indispon')

    visitRelease10('/billing', { tester: true, usage: 1 })
    cy.get('[data-testid="billing-checkout-button"]').should('not.be.disabled').click()
    cy.window().its('__release10FunctionCalls').should((calls) => {
      expect(calls.some((call) => call.name === 'billing-create-checkout')).to.eq(true)
    })
  })
})
