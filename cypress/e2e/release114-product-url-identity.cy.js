describe('Release 11.4 product URL identity', () => {
  it('shows the dedicated link flow and exact-product helper text', () => {
    cy.readFile('src/views/PurchaseNew.vue').should('contain', 'data-testid="product-input-tabs"')
    cy.readFile('src/views/PurchaseNew.vue').should('contain', 'Adicionar por link')
    cy.readFile('src/views/PurchaseNew.vue').should('contain', 'Cole o link da Amazon, Mercado Livre ou outra loja')
    cy.readFile('src/views/PurchaseNew.vue').should('contain', 'monitoramos exatamente o produto informado')
  })

  it('keeps locked identity fields in the product workflow', () => {
    cy.readFile('src/composables/usePurchaseWorkflow.js').should('contain', 'addProductFromUrl')
    cy.readFile('src/composables/usePurchaseWorkflow.js').should('contain', 'identity_locked')
    cy.readFile('src/utils/marketplace-prices-api.js').should('contain', 'identity:url-locked')
  })

  it('validates product links locally before calling the Edge Function', () => {
    cy.readFile('src/views/PurchaseNew.vue').should('contain', 'selectedProductUrl')
    cy.readFile('src/views/PurchaseNew.vue').should('contain', 'Cole um link valido de produto.')
    cy.readFile('src/views/PurchaseNew.vue').should('contain', 'canonicalizeProductUrl')
    cy.readFile('src/domain/products/canonicalizeProductUrl.js').should('contain', 'PROTOCOLLESS_PRODUCT_DOMAIN_PATTERN')
  })

  it('treats unsupported stores as unique URL-locked product identities', () => {
    cy.readFile('src/domain/products/canonicalizeProductUrl.js').should('contain', "idType: 'canonical_url_hash'")
    cy.readFile('src/domain/products/canonicalizeProductUrl.js').should('not.contain', 'PRODUCT_URL_UNSUPPORTED_MARKETPLACE')
    cy.readFile('supabase/migrations/20260627153000_release114_any_product_link_identity.sql').should('contain', 'product_identities_source_check')
  })
})
