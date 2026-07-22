import { installSupabaseStub, scopedStorageKey } from './release10-helpers.js'

const USER_ID = 'visual-audit-user'

function financeState() {
  return {
    settings: { year: 2026, selectedMonth: 7, currentMemberId: 'member-1', monthlySavingsCapacity: 900 },
    familyMembers: [{ id: 'member-1', name: 'Usuario Visual', role: 'administrator' }],
    financialAccounts: [
      { id: 'account-1', name: 'Conta corrente', type: 'Conta Corrente', balance: 6200 },
      { id: 'account-2', name: 'Reserva', type: 'Investimento', balance: 12000 },
    ],
    creditCards: [
      { id: 'card-1', name: 'Cartao principal', limit: 8000, availableLimit: 6100, closingDay: 20, dueDay: 8 },
    ],
    benefitWallets: [
      { id: 'benefit-1', name: 'VR', type: 'VR', balance: 430 },
    ],
    incomes: [
      { id: 'income-1', date: '2026-07-05', type: 'Salario', description: 'Salario', amount: 7200 },
    ],
    expenses: [
      { id: 'expense-1', date: '2026-07-10', category: 'Mercado', payment: 'Pix', description: 'Mercado', amount: 760 },
      { id: 'expense-2', date: '2026-07-12', category: 'Moradia', payment: 'Cartao', description: 'Condominio', amount: 980 },
    ],
    wishlist: [
      {
        id: 'wish-visual',
        name: 'Notebook de trabalho',
        description: 'Equipamento principal para produtividade',
        category: 'Tecnologia',
        priority: 'Alta',
        plannedPaymentMethod: 'card',
        installments: 6,
        priceStatus: 'pending_quote',
        price_search_status: 'not_found',
        priceHistory: [],
        marketplaceOffers: [],
      },
    ],
    recurringIncomes: [],
    recurringRules: [],
    internalTransfers: [],
    incomeDocuments: [],
    entryDocuments: [],
    planningGoals: [
      { id: 'goal-1', name: 'Reserva de emergencia', type: 'reserva_emergencia', target_amount: 12000, current_amount: 4200, monthly_contribution: 600, status: 'active' },
    ],
    categoryBudgets: [
      { id: 'budget-1', month_key: 202607, category: 'Mercado', planned: 1100 },
      { id: 'budget-2', month_key: 202607, category: 'Moradia', planned: 1600 },
    ],
    subscriptions: [
      {
        id: 'sub-visual',
        name: 'Netflix',
        provider: 'Netflix',
        category: 'Streaming',
        amount: 39.9,
        currency: 'BRL',
        billing_cycle: 'monthly',
        billing_interval: 1,
        next_billing_date: '2026-07-20',
        started_at: '2026-01-01',
        status: 'active',
        payment_method_type: 'card',
        card_id: 'card-1',
        is_essential: false,
        reminder_days: 3,
        url: 'https://www.netflix.com/cancelplan',
        source: 'manual',
      },
    ],
    subscriptionCharges: [],
    priceMonitorAlerts: [],
  }
}

function visitAuthenticated(path, width) {
  cy.viewport(width, 844)
  cy.visit(path, {
    onBeforeLoad(win) {
      installSupabaseStub(win, {
        userId: USER_ID,
        email: 'visual-audit@example.com',
        admin: 'owner',
        subscription: { status: 'active', plan_code: 'premium_monthly' },
      })
      win.localStorage.setItem(scopedStorageKey(USER_ID), JSON.stringify(financeState()))
    },
  })
}

function expectNoHorizontalOverflow() {
  cy.window().then((win) => {
    const doc = win.document.documentElement
    expect(doc.scrollWidth, 'document scroll width').to.be.lte(win.innerWidth + 1)
    ;[...win.document.querySelectorAll('main, aside, nav, section, article, form, table')].forEach((el) => {
      const rect = el.getBoundingClientRect()
      expect(rect.left, `${el.tagName} left`).to.be.gte(-1)
      expect(rect.right, `${el.tagName} right`).to.be.lte(win.innerWidth + 1)
    })
  })
}

function expectFirstViewportContent() {
  cy.window().then((win) => {
    const visibleText = [...win.document.querySelectorAll('main, section, article, form, nav')]
      .filter((el) => {
        const rect = el.getBoundingClientRect()
        const style = win.getComputedStyle(el)
        return style.visibility !== 'hidden'
          && style.display !== 'none'
          && rect.bottom > 96
          && rect.top < win.innerHeight - 76
      })
      .map((el) => el.textContent.trim())
      .join(' ')
      .replace(/\s+/g, ' ')

    expect(visibleText.length, 'useful text in first viewport').to.be.greaterThan(40)
  })
}

function capture(path, width, name, readySelector) {
  visitAuthenticated(path, width)
  cy.get(readySelector, { timeout: 12000 }).should('be.visible')
  cy.get('body').should('not.contain.text', '404')
  cy.get('body').should('not.contain.text', 'Produto nao encontrado')
  cy.get('[data-testid="app-sidebar"]').should(width < 1024 ? 'not.be.visible' : 'be.visible')
  expectNoHorizontalOverflow()
  expectFirstViewportContent()
  cy.screenshot(`visual-audit/${width}-${name}`, { capture: 'viewport' })
}

describe('Practical visual audit', () => {
  const widths = [360, 390, 412, 480, 768]
  const routes = [
    ['/dashboard', 'dashboard', '[data-testid="dashboard-page"]'],
    ['/entries', 'entries', '[data-testid="entries-page"]'],
    ['/structure?tab=accounts', 'accounts', '.structure-view'],
    ['/reports', 'reports', '[data-testid="reports-page"]'],
    ['/plan', 'plan', '[data-testid="release8-planning"]'],
    ['/goals', 'goals', '[data-testid="goals-page"]'],
    ['/budget', 'budget', '[data-testid="budget-page"]'],
    ['/subscriptions', 'subscriptions', '[data-testid="subscriptions-page"]'],
    ['/purchases', 'wishlist', '.wishlist-page'],
    ['/settings', 'settings', '[data-testid="settings-page"]'],
  ]

  widths.forEach((width) => {
    routes.forEach(([path, name, readySelector]) => {
      it(`captures ${name} at ${width}px without overflow`, () => {
        capture(path, width, name, readySelector)
      })
    })
  })

  ;[360, 768].forEach((width) => {
    it(`captures public landing at ${width}px with readable copy`, () => {
      cy.viewport(width, 844)
      cy.visit('/')
      cy.get('body').should('not.contain.text', '404')
      cy.get('[data-testid="landing-page"]').should('be.visible')
      expectNoHorizontalOverflow()
      expectFirstViewportContent()
      cy.screenshot(`visual-audit/${width}-landing`, { capture: 'viewport' })
    })
  })
})
