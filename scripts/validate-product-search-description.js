import assert from 'node:assert/strict'
import fs from 'node:fs'

const frontendNormalizer = fs.readFileSync('src/domain/products/productDescriptionNormalizer.js', 'utf8')
const frontendIdentity = fs.readFileSync('src/utils/productIdentity.js', 'utf8')
const edgeNormalizer = fs.readFileSync('supabase/functions/_shared/product-identity/normalizer.ts', 'utf8')
const edgeIdentity = fs.readFileSync('supabase/functions/_shared/product-identity/index.ts', 'utf8')
const edgeFunction = fs.readFileSync('supabase/functions/product-search-by-description/index.ts', 'utf8')
const workflow = fs.readFileSync('src/composables/usePurchaseWorkflow.js', 'utf8')
const cypress = fs.readFileSync('cypress/e2e/release11-product-description.cy.js', 'utf8')

for (const source of [`${frontendNormalizer}\n${frontendIdentity}`, `${edgeNormalizer}\n${edgeIdentity}`]) {
  assert.ok(source.includes('ld') && source.includes('punto'), 'Normalizador precisa cobrir abreviacoes de autopeca.')
  assert.ok(source.includes('needs_clarification'), 'Normalizador precisa sinalizar clarificacao.')
  assert.ok(source.includes('GENERIC_DESCRIPTION'), 'Normalizador precisa bloquear descricoes genericas.')
}

assert.ok(edgeFunction.includes('requireAuthenticatedUser(req)'), 'Busca por descricao precisa validar JWT.')
assert.ok(edgeFunction.includes('rejectIdentityOverride(body)'), 'Busca por descricao precisa rejeitar user_id do body.')
assert.ok(edgeFunction.includes('price-search'), 'Busca por descricao precisa chamar price-search.')
assert.ok(edgeFunction.includes('user_id=eq.${encodeURIComponent(userId)}'), 'Busca por descricao precisa carregar finance_states por user_id do JWT.')
assert.equal(/body\.user_id|body\.userId/.test(edgeFunction), false, 'Edge Function nao pode usar user_id do body.')
assert.equal((edgeFunction.match(/await saveFinanceState/g) || []).length, 1, 'Busca por descricao deve gravar finance_states uma unica vez.')
assert.ok(workflow.includes('normalizeProductDescription'), 'Nova compra por texto precisa normalizar descricao antes de salvar.')
assert.ok(cypress.includes('lanterna tras ld punto') && cypress.includes('lanterna traseira direita Fiat Punto'), 'Cypress precisa cobrir descricao abreviada.')

console.log('Product search by description validation: PASS')
