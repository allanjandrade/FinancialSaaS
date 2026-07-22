import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import AccountsKpiCards from '@/components/financial-accounts/AccountsKpiCards.vue'

const componentDir = 'src/components/financial-accounts'

function readComponent(file) {
  return fs.readFileSync(path.join(componentDir, file), 'utf8')
}

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
function blockFor(source, selector) {
  const selectorPattern = escapeRegex(selector)
  const selectorBoundary = '(?=$|[\\s,.:>+~\\[\\)#\\{])'
  const rulePattern = new RegExp(`(?=(?:^|[{}])\\s*([^{}]*?${selectorPattern}${selectorBoundary}[^{}]*)\\{([^{}]*)\\})`, 'g')
  const blocks = []
  let match

  while ((match = rulePattern.exec(source)) !== null) {
    blocks.push(`${match[1]} {${match[2]}}`)
    rulePattern.lastIndex += 1
  }

  return blocks.join('\n')
}

describe('financial accounts component refactor', () => {
  it('extracts the account screen surface into isolated components', () => {
    const files = [
      'AccountsKpiCards.vue',
      'AccountsTabs.vue',
      'AccountsTable.vue',
      'AccountsActionBar.vue',
    ]

    for (const file of files) {
      expect(fs.existsSync(path.join(componentDir, file))).toBe(true)
    }

    const structure = fs.readFileSync('src/views/FinancialStructure.vue', 'utf8')

    expect(structure).toContain('import AccountsKpiCards')
    expect(structure).toContain('import AccountsTabs')
    expect(structure).toContain('import AccountsTable')
    expect(structure).toContain('import AccountsActionBar')
    expect(structure).toContain('<AccountsKpiCards')
    expect(structure).toContain('<AccountsTabs')
    expect(structure).toContain('<AccountsTable')
    expect(structure).toContain('<AccountsActionBar')
  })

  it('delivers the B2B table sync contract', () => {
    const table = readComponent('AccountsTable.vue')

    expect(table).toContain('accounts-table')
    expect(table).toContain('account-name')
    expect(table).toContain('account-mono')
    expect(table).toContain('sync-badge')
    expect(table).toContain('lastSyncedAt')
    expect(table).toContain("emit('retrySync'")
    expect(table).toContain('aria-label')
  })

  it('delivers bulk select and CSV preview actions', () => {
    const actionBar = readComponent('AccountsActionBar.vue')

    expect(actionBar).toContain('selectedCount')
    expect(actionBar).toContain('type="file"')
    expect(actionBar).toContain('csv-preview')
    expect(actionBar).toContain('parseCsvPreview')
    expect(actionBar).toContain("emit('importCsv'")
  })

  it('keeps account component typography on global tokens only', () => {
    const components = [
      'AccountsKpiCards.vue',
      'AccountsTabs.vue',
      'AccountsTable.vue',
      'AccountsActionBar.vue',
    ]

    for (const component of components) {
      const source = readComponent(component)
      expect(source).toContain('font-family: var(--font-sans)')
      expect(source).not.toContain("'Syne'")
      expect(source).not.toContain("'DM Serif Display'")
    }

    expect(readComponent('AccountsKpiCards.vue')).toContain('font-family: var(--font-display)')
  })

  it('keeps accounts and cards on the global app palette', () => {
    const files = [
      'src/views/FinancialStructure.vue',
      path.join(componentDir, 'AccountsKpiCards.vue'),
      path.join(componentDir, 'AccountsTabs.vue'),
      path.join(componentDir, 'AccountsTable.vue'),
      path.join(componentDir, 'AccountsActionBar.vue'),
    ]
    const source = files.map((file) => fs.readFileSync(file, 'utf8')).join('\n')

    for (const token of ['#d5b260', '213, 178, 96', '#fff7e6', '#f0c66c', '#070b14', '#0b1120']) {
      expect(source, `accounts screen must not use ${token}`).not.toContain(token)
    }

    expect(source).toContain('var(--accent)')
    expect(source).toContain('var(--text-primary)')
    expect(source).toContain('var(--text-secondary)')
    expect(source).toContain('var(--border-color)')
  })

  it('keeps the structure page aligned with the app shell instead of a custom dark surface', () => {
    const structure = fs.readFileSync('src/views/FinancialStructure.vue', 'utf8')

    expect(structure).toContain('background: transparent')
    expect(structure).toContain('border-color: transparent')
    expect(structure).not.toContain('background: var(--bg-shell')
    expect(structure).toContain('ledger-page-shell')
    expect(structure).toContain('ledger-workspace')
    expect(blockFor(structure, '.panel')).toContain('background: transparent')
    expect(blockFor(structure, '.panel')).toContain('box-shadow: none')
    expect(blockFor(structure, '.panel')).not.toContain('box-shadow: var(--shadow-card)')
    expect(blockFor(structure, '.accounts-entry-panel')).toContain('background: transparent')
    expect(blockFor(structure, '.accounts-entry-panel')).not.toContain('box-shadow: var(--shadow-card)')
    expect(structure).toContain('top: calc(68px + 1rem)')
  })

  it('keeps the accounts dashboard responsive instead of squeezing KPI cards', () => {
    const structure = fs.readFileSync('src/views/FinancialStructure.vue', 'utf8')
    const kpis = readComponent('AccountsKpiCards.vue')

    expect(structure).toContain('grid-template-columns: minmax(300px, 0.32fr) minmax(0, 0.68fr);')
    expect(structure).toContain('grid-template-columns: minmax(0, 1fr) minmax(280px, 0.28fr);')
    expect(structure).toContain('class="accounts-layout ledger-workspace"')
    expect(structure).toContain('class="accounts-sidebar"')
    expect(structure).toContain('class="accounts-main"')
    expect(structure).toContain('class="accounts-context-panel"')
    expect(kpis).toContain('grid-template-columns: repeat(3, minmax(0, 1fr));')
    expect(kpis).not.toContain('repeat(6')
  })

  it('does not render the family profile banner inside the accounts tab', () => {
    const structure = fs.readFileSync('src/views/FinancialStructure.vue', 'utf8')

    expect(structure).not.toContain('import AccountsEntityBanner')
    expect(structure).not.toContain('<AccountsEntityBanner')
    expect(structure).toContain('class="accounts-sidebar"')
    expect(structure).toContain('class="panel accounts-entry-panel"')
  })

  it('uses the v3.2 operational context panel without reintroducing family profile noise', () => {
    const structure = fs.readFileSync('src/views/FinancialStructure.vue', 'utf8')

    expect(structure).toContain('import OperationalContextPanel')
    expect(structure).toContain('<OperationalContextPanel')
    expect(structure).toContain('financialContextItems')
    expect(structure).toContain('financialContextAlerts')
    expect(structure).toContain('technical-panel--secondary')
    expect(structure).not.toContain('Perfil Familiar')
    expect(structure).not.toContain('Test Family')
  })

  it('matches the B2B treasury dashboard surface requested in TODO', () => {
    const structure = fs.readFileSync('src/views/FinancialStructure.vue', 'utf8')
    const kpis = readComponent('AccountsKpiCards.vue')
    const table = readComponent('AccountsTable.vue')
    const actionBar = readComponent('AccountsActionBar.vue')

    for (const tabId of ['accounts', 'cards', 'entities', 'integrations', 'audit', 'pending']) {
      expect(structure).toContain(`id: '${tabId}'`)
    }

    for (const label of ['Saldo Consolidado', 'Disponível', 'A Compensar', 'Sincronização %', 'Alertas', 'Data Quality']) {
      expect(kpis).toContain(label)
    }

    expect(table).toContain('account-document')
    expect(table).toContain('account-status')
    expect(table).toContain('Pix')
    expect(table).toContain('statusLabel')

    for (const emittedAction of ['bulkActivate', 'bulkDeactivate', 'forceSync', 'exportCsv']) {
      expect(actionBar).toContain(`emit('${emittedAction}'`)
      expect(structure).toContain(`@${emittedAction.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)}=`)
    }
  })

  it('uses real tab styling below the financial accounts title', () => {
    const tabs = fs.readFileSync('src/components/ui/AppTabs.vue', 'utf8')
    const accountTabs = readComponent('AccountsTabs.vue')

    expect(accountTabs).toContain('role="tablist"')
    expect(tabs).toContain('.app-tabs__tab--active::after')
    expect(tabs).toContain('height: 3px;')
    expect(tabs).toContain('background: var(--accent-purple);')
    expect(tabs).not.toContain('background: var(--bg-hover);')
  })

  it('keeps the accounts more menu visually aligned with premium tabs', () => {
    const accountTabs = readComponent('AccountsTabs.vue')

    expect(accountTabs).toContain('aria-haspopup="menu"')
    expect(accountTabs).toContain(':aria-expanded="moreMenuOpen"')
    expect(accountTabs).toContain('role="menu"')
    expect(accountTabs).toContain('role="menuitemradio"')
    expect(accountTabs).toContain('more-current')
    expect(accountTabs).toContain('overflow: visible')
    expect(accountTabs).toContain('backdrop-filter: blur(16px)')
    expect(accountTabs).toContain('.accounts-tab-menu::before')
    expect(accountTabs).not.toContain('<details')
    expect(accountTabs).not.toContain('<summary')
  })

  it('keeps financial structure tabs reflected in the route query', () => {
    const structure = fs.readFileSync('src/views/FinancialStructure.vue', 'utf8')

    expect(structure).toContain('const router = useRouter()')
    expect(structure).toContain('@update:active-tab="handleTabChange"')
    expect(structure).toContain('function handleTabChange(tab)')
    expect(structure).toContain('router.replace({')
    expect(structure).toContain("path: '/structure'")
    expect(structure).toContain('tab: nextTab')
    for (const tabId of ['accounts', 'cards', 'benefits', 'integrations', 'audit', 'pending']) {
      expect(structure).toContain(`id: '${tabId}'`)
    }
  })

  it('renders account empty state as a centered bank guidance card', () => {
    const structure = fs.readFileSync('src/views/FinancialStructure.vue', 'utf8')
    const table = readComponent('AccountsTable.vue')

    expect(table).toContain('accounts-table-card--empty')
    expect(structure).toContain(':icon="Landmark"')
    expect(structure).toContain('Nenhuma conta cadastrada ainda')
    expect(structure).toContain('Adicione sua primeira conta para acompanhar saldos, receitas e despesas com mais clareza.')
    expect(structure).not.toContain('Cadastre sua primeira conta...')
  })

  it('keeps Portuguese copy polished on the accounts surface', () => {
    const sources = [
      fs.readFileSync('src/views/FinancialStructure.vue', 'utf8'),
      fs.readFileSync('src/components/brand/AppLogo.vue', 'utf8'),
      readComponent('AccountsKpiCards.vue'),
      readComponent('AccountsTable.vue'),
    ].join('\n')

    expect(sources).toContain('Operação financeira')
    expect(sources).toContain('Disponível')
    expect(sources).toContain('Sincronização %')
    expect(sources).toContain('Cartão')
    expect(sources).toContain('Lançamento')
    for (const badCopy of ['Operacao financeira', 'Disponivel', 'Sincronizacao %', 'Cartao', 'Lancamento']) {
      expect(sources).not.toContain(badCopy)
    }
  })

  it('uses an app modal instead of a native prompt for credit card dependents', () => {
    const structure = fs.readFileSync('src/views/FinancialStructure.vue', 'utf8')

    expect(structure).not.toContain('prompt(')
    expect(structure).toContain('dependentTarget')
    expect(structure).toContain('confirmDependent')
    expect(structure).toContain('Adicionar dependente')
  })

  it('does not count inactive accounts as available balance', () => {
    const wrapper = mount(AccountsKpiCards, {
      props: {
        accounts: [
          { id: 'active', name: 'Conta ativa', active: true, balance: 100, availableBalance: 100 },
          { id: 'inactive', name: 'Conta inativa', active: false, balance: 900, availableBalance: 900 },
        ],
      },
    })

    const availableCard = wrapper.findAll('.kpi-card')
      .find((card) => card.text().includes('Disponível'))

    expect(availableCard?.text()).toMatch(/R\$\s*100,00/)
    expect(availableCard?.text()).not.toMatch(/R\$\s*1\.000,00/)
  })
})
