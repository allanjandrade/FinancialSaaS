const STORAGE_KEY = 'controle-financeiro-app-v2'
const scopedStorageKey = (userId = '11111111-1111-4111-8111-111111111111') => `${STORAGE_KEY}:${userId}`

function queryResult(data = null) {
  const result = { data, error: null }
  let chain
  chain = new Proxy({}, {
    get(_target, property) {
      if (property === 'then') return (resolve) => Promise.resolve(result).then(resolve)
      if (property === 'single' || property === 'maybeSingle') return () => Promise.resolve(result)
      return () => chain
    },
  })
  return chain
}

function visitAutomations() {
  cy.visit('/automations', {
    onBeforeLoad(win) {
      const user = { id: '11111111-1111-4111-8111-111111111111', email: 'release5@example.com' }
      const session = { access_token: 'e2e-token', user }
      const channel = { on: () => channel, subscribe: () => channel }
      win.SUPABASE_CONFIG = { url: 'https://example.supabase.co', anonKey: 'e2e-anon' }
      win.supabase = {
        auth: {
          getSession: async () => ({ data: { session }, error: null }),
          getUser: async () => ({ data: { user }, error: null }),
          onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
        },
        from: () => queryResult(null),
        rpc: () => Promise.resolve({ data: null, error: null }),
        channel: () => channel,
        removeChannel: () => {},
        functions: { invoke: async () => ({ data: null, error: null }) },
      }
      win.localStorage.setItem(scopedStorageKey(), JSON.stringify({
        settings: { year: 2026, selectedMonth: 6 },
        family: { id: 'family-1' },
        familyMembers: [],
        financialAccounts: [],
        creditCards: [],
        benefitWallets: [],
        incomes: [],
        expenses: [],
        wishlist: [],
      }))
    },
  })
}

describe('Release 5 automations', () => {
  it('manages template-based automations without financial writes', () => {
    const templates = [
      {
        id: 'cash_balance_below',
        name: 'Saldo baixo',
        description: 'Avisa quando o saldo fica abaixo do limite.',
        category: 'cash',
        parameter_schema: {},
        default_cooldown_hours: 24,
      },
      {
        id: 'card_bill_ratio_above',
        name: 'Fatura alta',
        description: 'Avisa quando a fatura ultrapassa uma porcentagem da renda.',
        category: 'card',
        parameter_schema: {},
        default_cooldown_hours: 24,
      },
    ]
    const automations = []
    const runs = []
    const notifications = []

    cy.intercept('POST', '**/functions/v1/automation-config', (req) => {
      expect(req.body).not.to.have.keys(['user_id', 'userId', 'family_id', 'familyId', 'script', 'code', 'prompt'])
      if (req.body.parameters) {
        expect(req.body.parameters).not.to.have.keys(['script', 'code', 'prompt', 'webhook', 'whatsapp', 'gmail', 'phone'])
      }
      if (req.body.action === 'list_templates') {
        req.reply({ body: { templates } })
        return
      }
      if (req.body.action === 'list_user_automations') {
        req.reply({ body: { automations, runs } })
        return
      }
      if (req.body.action === 'list_notifications') {
        req.reply({ body: { notifications } })
        return
      }
      if (req.body.action === 'create_automation') {
        expect(req.body).to.include({
          template_id: 'card_bill_ratio_above',
          cadence: 'daily',
          cooldown_hours: 24,
        })
        expect(req.body.parameters).to.deep.equal({ ratio: 0.2 })
        const automation = {
          id: 'auto-1',
          template_id: req.body.template_id,
          name: req.body.name,
          parameters: req.body.parameters,
          status: 'active',
          timezone: 'America/Sao_Paulo',
          cadence: req.body.cadence,
          cooldown_hours: req.body.cooldown_hours,
          next_run_at: '2026-06-18T12:00:00.000Z',
          last_evaluated_at: null,
          last_triggered_at: null,
          created_at: '2026-06-18T11:00:00.000Z',
          updated_at: '2026-06-18T11:00:00.000Z',
        }
        automations.unshift(automation)
        req.reply({ statusCode: 201, body: { automation } })
        return
      }
      if (req.body.action === 'pause_automation') {
        automations[0].status = 'paused'
        req.reply({ body: { automation: automations[0] } })
        return
      }
      if (req.body.action === 'resume_automation') {
        automations[0].status = 'active'
        req.reply({ body: { automation: automations[0] } })
        return
      }
      if (req.body.action === 'mark_notification_read') {
        notifications[0].read_at = '2026-06-18T13:05:00.000Z'
        req.reply({ body: { notification: notifications[0] } })
        return
      }
      req.reply({ statusCode: 400, body: { error: { code: 'UNEXPECTED_ACTION', message: req.body.action } } })
    }).as('automationConfig')

    visitAutomations()
    cy.get('[data-testid="automations-page"]').should('contain.text', 'Automações apenas avisam')
    cy.window().then((win) => {
      win.__release5StorageBefore = win.localStorage.getItem(scopedStorageKey())
    })

    cy.get('[data-testid="automation-template-select"]').select('card_bill_ratio_above')
    cy.get('[data-testid="automation-name-input"]').clear().type('Fatura alta controlada')
    cy.get('[data-testid="automation-param-ratio"]').clear().type('0.2')
    cy.get('[data-testid="automation-create"]').click()
    cy.get('[data-testid="automation-row"]').should('contain.text', 'Fatura alta controlada')
    cy.get('[data-testid="automation-row"]').should('contain.text', 'ativa')

    cy.get('[data-testid="automation-pause"]').click()
    cy.get('[data-testid="automation-row"]').should('contain.text', 'pausada')
    cy.get('[data-testid="automation-resume"]').click()
    cy.get('[data-testid="automation-row"]').should('contain.text', 'ativa')

    cy.then(() => {
      runs.unshift({
        id: 'run-1',
        automation_id: 'auto-1',
        template_id: 'card_bill_ratio_above',
        status: 'success',
        triggered: true,
        dedupe_key: 'automation:auto-1:template:card_bill_ratio_above:window:2026-06-18:signal:abc',
        result_payload: { title: 'Fatura alta' },
        started_at: '2026-06-18T13:00:00.000Z',
        finished_at: '2026-06-18T13:00:01.000Z',
      })
      notifications.unshift({
        id: 'notif-1',
        source: 'automation',
        source_id: 'run-1',
        severity: 'risk',
        title: 'Fatura alta',
        message: 'Fatura em 31% da renda mensal.',
        payload: { automation_id: 'auto-1' },
        read_at: null,
        created_at: '2026-06-18T13:00:01.000Z',
      })
    })
    cy.get('[data-testid="automation-refresh"]').click()
    cy.get('[data-testid="automation-runs"]').should('contain.text', 'sucesso').and('contain.text', 'Alerta emitido')
    cy.get('[data-testid="automation-notifications"]').should('contain.text', 'Fatura alta').and('contain.text', '1 não lidas')
    cy.get('[data-testid="automation-mark-read"]').click()
    cy.get('[data-testid="automation-notifications"]').should('contain.text', '0 não lidas')

    cy.window().then((win) => {
      expect(win.localStorage.getItem(scopedStorageKey())).to.equal(win.__release5StorageBefore)
    })
  })
})
