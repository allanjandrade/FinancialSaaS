import fs from 'node:fs'
import assert from 'node:assert/strict'

const router = fs.readFileSync('src/router/index.js', 'utf8')
const entries = fs.readFileSync('src/views/Entries.vue', 'utf8')

assert.ok(router.includes("path: '/entries'"), 'Rota /entries precisa existir')
assert.ok(entries.includes("route.query.transfer"), 'Entries precisa reagir a ?transfer=1')
assert.ok(entries.includes('Nova transferência'), 'Transferencia precisa ter titulo proprio')
assert.ok(entries.includes('Conta de origem'), 'Transferencia precisa campo de origem')
assert.ok(entries.includes('Conta de destino'), 'Transferencia precisa campo de destino')
assert.ok(entries.includes('addInternalTransfer'), 'Transferencia precisa usar addInternalTransfer')
assert.ok(entries.includes("entry.kind !== 'transfer'"), 'Transferencia nao deve ser tratada como receita/despesa editavel')

console.log('Transfer route validation: PASS')
