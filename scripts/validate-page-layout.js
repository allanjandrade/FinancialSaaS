import fs from 'node:fs'
import assert from 'node:assert/strict'

const entries = fs.readFileSync('src/views/Entries.vue', 'utf8')
assert.ok(entries.includes('data-testid="entries-page-header"'), 'Entries precisa de cabeçalho claro')
assert.ok(entries.includes('Novo lançamento'), 'Entries precisa de CTA principal')
assert.ok(entries.includes('Ações rápidas'), 'Entries precisa de ações rápidas')

const landing = fs.readFileSync('src/views/public/Landing.vue', 'utf8')
assert.ok(landing.includes('Privacidade e segurança'), 'Landing precisa de seção de privacidade')
assert.ok(landing.includes('public-footer'), 'Landing precisa de rodapé legal')

console.log('Page layout validation: PASS')
