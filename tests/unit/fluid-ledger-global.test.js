import fs from 'node:fs'
import { describe, expect, it } from 'vitest'

const read = (file) => fs.readFileSync(file, 'utf8')
const exists = (file) => fs.existsSync(file)

describe('fluid ledger global redesign', () => {
  it('defines ledger surface tokens and neutralizes raised card defaults', () => {
    const tokens = read('src/styles/tokens.css')
    const main = read('src/styles/main.css')
    const layout = read('src/styles/layout.css')

    expect(tokens).toContain('--surface-page:')
    expect(tokens).toContain('--surface-ledger:')
    expect(tokens).toContain('--surface-rail:')
    expect(tokens).toContain('--surface-muted:')
    expect(tokens).toContain('--divider:')
    expect(tokens).toContain('--divider-strong:')
    expect(tokens).toContain('--shadow-card: 0 0 0 1px transparent')
    expect(tokens).toContain('--shadow-card-hover: 0 0 0 1px transparent')

    expect(main).toContain('/* Fluid Ledger global surfaces */')
    expect(main).toContain('.panel,')
    expect(main).toContain('.summary-card,')
    expect(main).toContain('.dashboard-panel,')
    expect(main).toContain('.app-card')
    expect(main).toContain('background: var(--surface-ledger)')
    expect(main).toContain('box-shadow: none')
    expect(main).toContain('border-radius: var(--radius-sm)')
    expect(main).not.toContain('transform: translateY(-')

    expect(layout).toContain('background: var(--surface-ledger)')
    expect(layout).toContain('box-shadow: none')
  })

  it('provides semantic ledger layout primitives', () => {
    const files = [
      'src/components/layout/LedgerPage.vue',
      'src/components/layout/LedgerSection.vue',
      'src/components/layout/LedgerStrip.vue',
      'src/components/layout/LedgerTable.vue',
      'src/components/layout/LedgerRail.vue',
      'src/components/layout/LedgerEmptyState.vue',
    ]

    for (const file of files) {
      expect(exists(file), `${file} should exist`).toBe(true)
    }

    expect(read('src/components/layout/LedgerPage.vue')).toContain('class="ledger-page"')
    expect(read('src/components/layout/LedgerSection.vue')).toContain('class="ledger-section"')
    expect(read('src/components/layout/LedgerStrip.vue')).toContain('class="ledger-strip"')
    expect(read('src/components/layout/LedgerTable.vue')).toContain('class="ledger-table"')
    expect(read('src/components/layout/LedgerRail.vue')).toContain('class="ledger-rail"')
    expect(read('src/components/layout/LedgerEmptyState.vue')).toContain('class="ledger-empty-state"')
  })

  it('moves primary authenticated pages to ledger layout classes', () => {
    const pages = [
      'src/views/Home.vue',
      'src/views/Entries.vue',
      'src/views/FinancialStructure.vue',
      'src/views/Subscriptions.vue',
    ]

    for (const file of pages) {
      const source = read(file)
      expect(source, file).toContain('ledger-')
      expect(source, file).toContain('Ledger')
    }
  })

  it('moves public and auth pages to continuous institutional surfaces', () => {
    const pages = [
      'src/views/public/Landing.vue',
      'src/views/public/Pricing.vue',
      'src/views/Login.vue',
      'src/views/Signup.vue',
      'src/views/ForgotPassword.vue',
      'src/views/ResetPassword.vue',
      'src/views/AuthCallback.vue',
    ]

    for (const file of pages) {
      const source = read(file)
      expect(source, file).toContain('ledger-')
      expect(source, file).not.toContain('box-shadow: var(--shadow-card)')
    }
  })

  it('keeps cards only for explicit allowed exceptions', () => {
    const source = [
      read('src/views/Home.vue'),
      read('src/views/Entries.vue'),
      read('src/views/FinancialStructure.vue'),
      read('src/views/public/Landing.vue'),
      read('src/views/public/Pricing.vue'),
    ].join('\n')

    expect(source).not.toContain('hover {')
    expect(source).not.toContain('box-shadow: var(--shadow-card-hover)')
    expect(source).not.toContain('grid-template-columns: repeat(auto-fit, minmax(230px, 1fr))')
  })
})
