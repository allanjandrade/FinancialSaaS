import { visitRelease10 } from './release10-helpers.js'

describe('Release 11.2 plan access', () => {
  it('redirects free users from Premium advisor to Billing with a clear lock message', () => {
    visitRelease10('/dashboard')
    cy.get('.nav-toggle').click()
    cy.contains('.nav-item', 'Consultor').click()
    cy.location('pathname').should('eq', '/billing')
    cy.get('[data-testid="locked-feature-message"]').should('contain.text', 'Premium')
    cy.get('[data-testid="billing-checkout-button"]').should('be.disabled')
  })

  it('keeps premium-only feature rules aligned in source and edge resolver', () => {
    cy.readFile('src/domain/billing/plans.js').should('contain', 'price_search_monthly: 3')
    cy.readFile('src/domain/billing/plans.js').should('contain', 'wishlist_items: 5')
    cy.readFile('src/domain/billing/plans.js').should('contain', 'automations_active: 1')
    cy.readFile('supabase/functions/_shared/release10/entitlements.ts').should('contain', 'export_reports: false')
    cy.readFile('src/views/Reports.vue').should('contain', "planAccess.canUse('export_reports')")
  })
})
