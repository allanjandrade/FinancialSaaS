import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'

const targets = [
  'src/views/public',
  'src/views/Login.vue',
  'src/views/Signup.vue',
  'src/views/Settings.vue',
  'src/views/Billing.vue',
  'src/views/Reports.vue',
  'src/views/Automations.vue',
]

function walk(entry) {
  if (!fs.existsSync(entry)) return []
  const stat = fs.statSync(entry)
  if (stat.isFile()) return [entry]
  return fs.readdirSync(entry, { withFileTypes: true }).flatMap((item) => walk(path.join(entry, item.name)))
}

const source = targets.flatMap(walk).filter((file) => /\.(vue|js)$/.test(file)).map((file) => fs.readFileSync(file, 'utf8')).join('\n')
const forbidden = [
  'Facebook',
  'Entrar com Facebook',
  'Continuar com Facebook',
  'server-side',
  'dados minimizados',
  'determinístico',
  'sem inventar valores',
  'Gemini',
  'finance_states',
  'registro auditável',
  'wishlist_item',
  'suporte@financeiro.app',
  'go-live controlado',
]

for (const term of forbidden) assert.equal(source.includes(term), false, `Copy pública contém termo proibido: ${term}`)

const unaccented = /\b(configuracao|demonstracao|automacao|lancamento|preco|periodo|voce|gratis|orcamento|relatorios|execucao|historico)\b/i
assert.equal(unaccented.test(source), false, 'Copy pública contém termo sem acentuação pt-BR')

console.log('Public copy validation: PASS')
