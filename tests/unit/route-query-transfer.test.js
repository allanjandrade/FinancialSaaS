import fs from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('Release 11 transfer route query', () => {
  it('opens Entries transfer mode from query and uses internal transfer API', () => {
    const entries = fs.readFileSync('src/views/Entries.vue', 'utf8')

    expect(entries).toContain('route.query.transfer')
    expect(entries).toContain('Nova transferência')
    expect(entries).toContain('Conta de origem')
    expect(entries).toContain('Conta de destino')
    expect(entries).toContain('financeStore.addInternalTransfer')
    expect(entries).not.toMatch(/entryType\.value === 'transfer'[\s\S]{0,120}addIncome/)
  })
})
