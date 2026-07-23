import { describe, expect, it } from 'vitest'
import fs from 'node:fs'

const read = (file) => fs.readFileSync(file, 'utf8')

describe('operations UI upgrade', () => {
  it('gives card and benefit operation screens a mature operational shell', () => {
    const card = read('src/views/Card.vue')
    const benefit = read('src/views/Benefit.vue')

    for (const source of [card, benefit]) {
      expect(source).toContain('data-testid="operation-hero"')
      expect(source).toContain('class="operation-shell')
      expect(source).toContain('operation-layout')
      expect(source).toContain('operation-metric-rail')
      expect(source).toContain('operation-side-panel')
    }

    expect(card).toContain('data-testid="card-operation-page"')
    expect(card).toContain('Uso do limite')
    expect(card).toContain('Registrar despesa')

    expect(benefit).toContain('data-testid="benefit-operation-page"')
    expect(benefit).toContain('Eficiência de uso')
    expect(benefit).toContain('Registrar consumo')
  })

  it('turns the admin operational page into a control room layout', () => {
    const operational = read('src/views/Operational.vue')

    expect(operational).toContain('data-testid="operational-control-room"')
    expect(operational).toContain('data-testid="operation-hero"')
    expect(operational).toContain('operational-command-grid')
    expect(operational).toContain('operational-control-bar')
    expect(operational).toContain('operational-side-panel')
    expect(operational).toContain('Saúde das funções')
  })

  it('brings entries and accounts navigation into the premium operations language', () => {
    const entries = read('src/views/Entries.vue')
    const accountsTabs = read('src/components/financial-accounts/AccountsTabs.vue')
    const structure = read('src/views/FinancialStructure.vue')

    expect(entries).toContain('class="entries-view operation-shell ledger-page-shell"')
    expect(entries).toContain('data-testid="operation-hero"')
    expect(entries).toContain('data-testid="entry-ocr-primary-action"')
    expect(entries).toContain('openPrimaryOcr')
    expect(entries).toContain('manual-entry-disclosure')
    expect(entries).toContain('Escanear documento (OCR)')
    expect(entries).toContain('data-testid="entry-review-panel"')
    expect(entries).toContain('reviewPanelOpen')
    expect(entries).toContain('import OperationalContextPanel')
    expect(entries).toContain('<OperationalContextPanel')
    expect(entries).toContain('entriesContextItems')
    expect(entries).toContain('entriesContextAlerts')
    expect(entries).toContain('Importar extrato')
    expect(entries).not.toContain('entry-command-panel')
    expect(entries).not.toContain('OCR e importação')
    expect(entries).not.toContain('OCR e importacao')
    expect(entries).not.toContain('ocr-primary-card')

    expect(accountsTabs).toContain('data-testid="accounts-premium-tabs"')
    expect(accountsTabs).toContain('accounts-tab-orbit')
    expect(accountsTabs).toContain('accounts-tab-more')
    expect(accountsTabs).toContain('secondaryTabs')
    expect(accountsTabs).toContain('tab-count')
    expect(structure).toContain("const accountFormVisible = ref(false)")
    expect(structure).toContain('class="accounts-layout ledger-workspace"')
    expect(structure).toContain("'form-hidden': !accountFormVisible")
    expect(structure).not.toContain('accounts-command-strip')
  })
})
