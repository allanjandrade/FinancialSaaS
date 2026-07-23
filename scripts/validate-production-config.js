import assert from 'node:assert/strict'
import fs from 'node:fs'

for (const file of [
  'docs/production/PRODUCTION_PROVIDER_DECISION.md',
  'docs/production/DOMAIN_SETUP.md',
  'docs/production/ENVIRONMENT_CHECKLIST.md',
  'docs/production/EDGE_FUNCTIONS_INVENTORY.md',
]) {
  assert.ok(fs.existsSync(file), `Documento de producao ausente: ${file}`)
}

const envChecklist = fs.readFileSync('docs/production/ENVIRONMENT_CHECKLIST.md', 'utf8')
for (const term of ['VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_ROLE_KEY', 'webhook secret']) {
  assert.ok(envChecklist.includes(term), `Checklist sem termo: ${term}`)
}

console.log('Production config validation: PASS')
