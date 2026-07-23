describe('Release 11.4 multiple product links', () => {
  it('surfaces multiple links as an explicit user choice', () => {
    cy.readFile('src/views/PurchaseNew.vue').should('contain', 'data-testid="multiple-product-links"')
    cy.readFile('src/views/PurchaseNew.vue').should('contain', 'data-testid="add-all-product-links"')
    cy.readFile('supabase/functions/product-from-url/index.ts').should('contain', "status: 'multiple_urls_detected'")
    cy.readFile('supabase/functions/product-from-url/index.ts').should('contain', 'multiple_product_urls_detected')
  })
})
