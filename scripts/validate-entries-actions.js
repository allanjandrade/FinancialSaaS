import assert from 'node:assert/strict'
import fs from 'node:fs'

const entries = fs.readFileSync('src/views/Entries.vue', 'utf8')
const router = fs.readFileSync('src/router/index.js', 'utf8')

for (const action of ['Despesa', 'Receita', 'Transfer', 'Importar']) {
  assert.ok(entries.includes(action), `Entradas sem acao obrigatoria: ${action}`)
}

assert.ok(entries.includes('data-testid="entries-transfer-action"'), 'Atalho de transferencia precisa ser testavel.')
assert.ok(entries.includes('router-link to="/entries?transfer=1"'), 'Atalho precisa abrir /entries?transfer=1.')
assert.ok(entries.includes("route.query.transfer"), 'Tela precisa observar query transfer.')
assert.ok(entries.includes("setEntryType('transfer')"), 'Query transfer precisa selecionar modo transferencia.')
assert.ok(entries.includes('nextTick(() => transferSourceInput.value?.focus?.())'), 'Transferencia precisa focar o primeiro campo util.')
assert.ok(entries.includes('delete query.transfer'), 'Query transfer precisa ser removida apos abertura.')
assert.ok(entries.includes("router.replace({ path: '/entries', query })"), 'Tela precisa limpar a query sem navegar para outra rota.')
assert.ok(entries.includes('financeStore.addInternalTransfer'), 'Transferencia precisa usar API de transferencia interna.')
assert.ok(entries.includes("showToast('Transfer"), 'Transferencia precisa dar retorno ao usuario.')
assert.ok(entries.includes("entry.kind !== 'transfer'"), 'Transferencia nao pode ser tratada como despesa/receita editavel.')
assert.equal(entries.includes('entries-new'), false, 'Tela nao pode manter botao grande Novo lancamento.')
assert.ok(router.includes("path: '/entries'"), 'Rota /entries precisa existir.')

const handleSubmitStart = entries.indexOf('async function handleSubmit()')
const transferStart = entries.indexOf("if (entryType.value === 'transfer')", handleSubmitStart)
const transferEnd = entries.indexOf('const opt = sourceOptions.value.find', transferStart)
const transferBranch = entries.slice(transferStart, transferEnd)

assert.ok(handleSubmitStart >= 0, 'Tela precisa manter handleSubmit.')
assert.ok(transferStart >= 0, 'handleSubmit precisa ter branch de transferencia.')
assert.ok(transferEnd > transferStart, 'Branch de transferencia precisa terminar antes do fluxo de despesa/receita.')
assert.ok(transferBranch.includes('addInternalTransfer'), 'Branch de transferencia precisa registrar transferencia interna.')
assert.equal(/addIncome|addExpense/.test(transferBranch), false, 'Branch de transferencia nao pode criar receita/despesa.')

console.log('Entries actions validation: PASS')
