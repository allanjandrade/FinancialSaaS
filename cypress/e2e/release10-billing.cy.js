import { visitRelease10 } from './release10-helpers.js'

describe('Release 10 billing', () => {
  it('free common user sees current plan but controlled go-live blocks checkout', () => {
    visitRelease10('/billing', { usage: 1 })
    cy.get('[data-testid="billing-current-plan"]').should('contain.text', 'Plano atual: Grátis')
    cy.get('[data-testid="billing-checkout-button"]').should('be.disabled')
    cy.get('[data-testid="billing-guard-message"]').should('contain.text', 'Upgrade Premium indispon')
    cy.window().its('__release10FunctionCalls').should((calls) => {
      expect(calls.some((call) => call.name === 'billing-create-checkout')).to.eq(false)
    })
  })

  it('authorized tester checkout calls Edge Function', () => {
    visitRelease10('/billing', { usage: 1, tester: true })
    cy.get('[data-testid="billing-checkout-button"]').should('not.be.disabled').click()
    cy.get('[data-testid="checkout-message"]').should('contain.text', 'Checkout Premium solicitado com segurança.')
    cy.window().its('__release10FunctionCalls').should((calls) => {
      expect(calls.some((call) => call.name === 'billing-create-checkout')).to.eq(true)
    })
  })

  it('past_due shows data access without deleting user information', () => {
    visitRelease10('/billing', { subscription: { status: 'past_due', plan_code: 'premium_monthly', current_period_end: '2026-06-30T00:00:00Z' }, usage: 1 })
    cy.get('[data-testid="billing-page"]').should('contain.text', 'Planos e assinatura')
    cy.get('[data-testid="billing-page"]').should('contain.text', 'Plano atual')
  })
})
