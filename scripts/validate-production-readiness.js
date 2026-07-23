import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

function read(file) {
  return fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : ''
}

function walk(dir) {
  if (!fs.existsSync(dir)) return []
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) return walk(full)
    return full
  })
}

assert.ok(fs.existsSync('docs/compliance/LGPD_DOSSIER.md'), 'Dossie LGPD ausente.')
assert.ok(fs.existsSync('docs/uat/RELEASE8_P0_UAT_EVIDENCE.md'), 'Evidencia UAT ausente.')
assert.ok(fs.existsSync('scripts/validate-valueserp-price-search.js'), 'Validador ValueSERP ausente.')
assert.ok(fs.existsSync('scripts/validate-rls-security.js'), 'Validador RLS ausente.')

const lgpd = read('docs/compliance/LGPD_DOSSIER.md')
for (const term of ['ValueSERP', 'dados financeiros', 'identidade pessoal', 'finance_states', 'revogar']) {
  assert.ok(lgpd.includes(term), `LGPD sem termo obrigatorio: ${term}`)
}

const frontend = walk('src')
  .filter((file) => /\.(js|vue|ts|html)$/.test(file))
  .map(read)
  .join('\n')

assert.ok(!frontend.includes('VALUE_SERP_API_KEY'), 'Frontend contem secret ValueSERP.')
assert.ok(!frontend.includes('SUPABASE_SERVICE_ROLE'), 'Frontend contem service role.')
assert.ok(!frontend.includes('service_role'), 'Frontend contem service_role.')
assert.ok(!frontend.includes('https://api.valueserp.com'), 'Frontend chama ValueSERP diretamente.')
assert.ok(!frontend.includes('generativelanguage.googleapis.com'), 'Frontend chama Gemini diretamente.')

const priceSearch = read('supabase/functions/price-search/index.ts')
for (const event of [
  'price_search_requested',
  'price_search_identity_required',
  'price_search_cache_hit',
  'price_search_provider_called',
  'price_search_provider_failed',
  'price_search_candidates_scored',
  'price_search_best_compatible_found',
  'price_search_no_compatible_offer',
  'price_search_rejected_candidate',
]) {
  assert.ok(priceSearch.includes(event), `Evento de observabilidade ausente: ${event}`)
}

console.log('Production readiness validation: PASS')
