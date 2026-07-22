import fs from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('Release 11.2 entries actions', () => {
  it('offers the compact action set and transfer query workflow', () => {
    const entries = fs.readFileSync('src/views/Entries.vue', 'utf8')

    for (const label of ['Despesa', 'Receita', 'Transferência', 'Importar']) {
      expect(entries).toContain(label)
    }
    expect(entries).toContain('data-testid="entries-transfer-action"')
    expect(entries).toContain('nextTick(() => transferSourceInput.value?.focus?.())')
    expect(entries).toContain('delete query.transfer')
    expect(entries).toContain('financeStore.addInternalTransfer')
    expect(entries).not.toContain('entries-new')
  })
})
