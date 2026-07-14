import fs from 'node:fs'
import { describe, expect, it } from 'vitest'
import { NAV_GROUPS, metaForPath } from '@/router/navigation.js'

const read = (file) => fs.readFileSync(file, 'utf8')

describe('release 3.2 integrated premium UX', () => {
  it('keeps intelligence second and operation as the execution group', () => {
    expect(NAV_GROUPS.map((group) => group.id)).toEqual([
      'inicio',
      'inteligencia',
      'operacao',
      'configuracoes',
    ])

    const operation = NAV_GROUPS.find((group) => group.id === 'operacao')
    expect(operation.items.map((item) => item.path)).toEqual([
      '/entries',
      '/structure?tab=accounts',
      '/card',
      '/benefit',
      '/subscriptions',
      '/family',
    ])

    expect(metaForPath('/subscriptions').group).toBe(operation.label)
    expect(metaForPath('/family').group).toBe(operation.label)
    expect(metaForPath('/subscriptions').breadcrumb.at(0)).toBe(operation.label)
    expect(metaForPath('/family').breadcrumb.at(0)).toBe(operation.label)
  })

  it('uses the shared operational context panel in premium operation screens', () => {
    const panel = read('src/components/layout/OperationalContextPanel.vue')
    const entries = read('src/views/Entries.vue')
    const structure = read('src/views/FinancialStructure.vue')

    expect(panel).toContain('data-testid="operational-context-panel"')
    expect(panel).toContain('operational-context__item')
    expect(panel).toContain('operational-context__alert')
    expect(entries).toContain('import OperationalContextPanel')
    expect(entries).toContain('<OperationalContextPanel')
    expect(structure).toContain('import OperationalContextPanel')
    expect(structure).toContain('<OperationalContextPanel')
  })

  it('keeps OCR as the single primary entry action without redundant cards', () => {
    const entries = read('src/views/Entries.vue')

    expect(entries).toContain('data-testid="entry-ocr-primary-action"')
    expect(entries).toContain('Escanear documento (OCR)')
    expect(entries).toContain('openPrimaryOcr')
    expect(entries).toContain('manual-entry-disclosure')
    expect(entries).toContain('data-testid="entry-review-panel"')
    expect(entries).not.toContain('OCR e importacao')
    expect(entries).not.toContain('ocr-primary-card')
    expect(entries).not.toContain('entry-command-panel')
  })

  it('keeps accounts as a clean hub with tabs, empty guidance and contextual form', () => {
    const structure = read('src/views/FinancialStructure.vue')

    expect(structure).toContain('<AccountsTabs')
    expect(structure).toContain('<AccountsKpiCards')
    expect(structure).toContain('<AccountsTable')
    expect(structure).toContain('accounts-layout')
    expect(structure).toContain('form-hidden')
    expect(structure).toContain('Nenhuma conta cadastrada ainda')
    expect(structure).toContain('Adicionar conta')
    expect(structure).not.toContain('AccountsEntityBanner')
    expect(structure).not.toContain('Perfil Familiar')
  })

  it('does not expose raw technical labels in primary UX files', () => {
    const source = [
      read('src/views/Entries.vue'),
      read('src/views/FinancialStructure.vue'),
      read('src/views/Advisor.vue'),
      read('src/components/layout/OperationalContextPanel.vue'),
    ].join('\n')

    expect(source).not.toMatch(/>\s*stable\s*</i)
    expect(source).not.toMatch(/>\s*undefined\s*</i)
    expect(source).not.toMatch(/Cobertura 0,0x/)
  })
})
