import { visitRelease10 } from './release10-helpers.js'

describe('Release 10 feature gating', () => {
  it('tester uses released billing feature but does not see admin panel', () => {
    visitRelease10('/billing', { usage: 3, tester: true })
    cy.get('[data-testid="billing-checkout-button"]').should('not.be.disabled')
    cy.get('[data-testid="paywall-card"]').should('not.exist')
    cy.get('[data-testid="app-sidebar"]').should('not.contain.text', 'Admin')
  })

  it('blocks checkout for common users in controlled go-live and allows tester checkout', () => {
    visitRelease10('/billing', { usage: 3 })
    cy.get('[data-testid="billing-checkout-button"]').should('be.disabled')
    cy.get('[data-testid="billing-guard-message"]').should('contain.text', 'Upgrade Premium indispon')

    visitRelease10('/billing', { usage: 3, tester: true })
    cy.get('[data-testid="billing-checkout-button"]').should('not.be.disabled').click()
    cy.window().its('__release10FunctionCalls').should((calls) => {
      expect(calls.some((call) => call.name === 'billing-create-checkout')).to.equal(true)
    })
  })

  it('premium subscription removes paywall', () => {
    visitRelease10('/billing', { subscription: { status: 'active', plan_code: 'premium_monthly' }, usage: 3 })
    cy.get('[data-testid="subscription-badge"]').should('contain.text', 'Premium')
    cy.get('[data-testid="billing-current-plan"]').should('contain.text', 'Plano atual: Premium')
    cy.get('[data-testid="paywall-card"]').should('not.exist')
  })
})
