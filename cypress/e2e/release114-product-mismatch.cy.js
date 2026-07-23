describe('Release 11.4 product mismatch blocking', () => {
  it('blocks divergent source product ids before accepting price candidates', () => {
    cy.readFile('src/domain/products/canonicalizeProductUrl.js').should('contain', 'PRODUCT_IDENTITY_MISMATCH_BLOCKED')
    cy.readFile('supabase/functions/price-search/index.ts').should('contain', 'assertProductIdentityMatch(identity')
    cy.readFile('supabase/functions/price-search/index.ts').should('contain', 'Resultado descartado por divergencia da identidade do link')
  })
})
