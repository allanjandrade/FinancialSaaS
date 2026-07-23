import assert from 'node:assert/strict'
import fs from 'node:fs'
import { normalizeProductIdentity } from '../src/utils/productIdentity.js'
import { chooseBestCompatibleOffer } from '../src/utils/productCandidateScoring.js'

const requiredFiles = [
  'supabase/functions/_shared/price-providers/types.ts',
  'supabase/functions/_shared/price-providers/valueserp.ts',
  'supabase/functions/_shared/price-providers/dataforseo.ts',
  'supabase/functions/_shared/price-providers/index.ts',
  'supabase/functions/_shared/product-identity/normalizer.ts',
  'supabase/functions/_shared/product-identity/scoring.ts',
  'supabase/functions/price-search/index.ts',
  'supabase/migrations/20260620100000_price_search_cache_valueserp.sql',
  'tests/unit/valueserp-provider.test.js',
  'tests/unit/price-search-valueserp.test.js',
  'cypress/e2e/release8-valueserp-price-search.cy.js',
]

for (const file of requiredFiles) {
  assert.ok(fs.existsSync(file), `Arquivo obrigatorio ausente: ${file}`)
}

const provider = fs.readFileSync('supabase/functions/_shared/price-providers/valueserp.ts', 'utf8')
const priceSearch = fs.readFileSync('supabase/functions/price-search/index.ts', 'utf8')
const frontend = fs.readdirSync('src', { recursive: true })
  .filter((file) => /\.(js|vue|ts)$/.test(String(file)))
  .map((file) => fs.readFileSync(`src/${file}`, 'utf8'))
  .join('\n')

assert.match(provider, /VALUE_SERP_API_KEY/)
assert.match(provider, /api\.valueserp\.com\/search/)
assert.match(provider, /search_type.*shopping/s)
assert.ok(!provider.includes('best_compatible_offer'), 'Provider nao pode decidir melhor oferta compativel.')
assert.match(priceSearch, /searchPriceProvider/)
assert.match(priceSearch, /chooseBestCompatibleOffer/)
assert.match(priceSearch, /identity_required/)
assert.match(priceSearch, /provider_error/)
assert.ok(!priceSearch.includes('best_offer'), 'price-search nao pode retornar best_offer legado.')
assert.ok(!frontend.includes('VALUE_SERP_API_KEY'), 'Frontend nao pode conter VALUE_SERP_API_KEY.')
assert.ok(!frontend.includes('https://api.valueserp.com'), 'Frontend nao pode chamar ValueSERP.')

const identity = normalizeProductIdentity('lanterna tras ld punto')
const candidates = [
  { title: 'Lanterna Traseira Siena Tampa Magneti Marelli', total: 110.25 },
  { title: 'Lanterna Traseira Hilux 2012/2015 Direita', total: 252.68 },
  { title: 'Lanterna Mala Direito Grand Siena', total: 209.61 },
  { title: 'Magneti Marelli Lanterna Fiat Palio Weekend', total: 213.21 },
  { title: 'Lanterna Fiat Palio Adventure', total: 229.77 },
  { title: 'Lanterna Traseira Direita Fiat Punto 2008 2009', total: 320 },
]
const result = chooseBestCompatibleOffer(candidates, identity)
assert.equal(result.status, 'found_compatible')
assert.equal(result.best_compatible_offer.total, 320)
assert.ok(result.rejected_candidates.some((item) => /Siena/.test(item.title)))
assert.ok(result.rejected_candidates.some((item) => /Hilux/.test(item.title)))

console.log('ValueSERP price search validation: PASS')
