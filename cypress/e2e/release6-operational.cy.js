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

function visitOperational({ adminRole = 'owner' } = {}) {
  cy.visit('/operational', {
    onBeforeLoad(win) {
      const user = { id: '11111111-1111-4111-8111-111111111111', email: 'release6@example.com' }
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
        functions: {
          invoke: async (name) => {
            if (name === 'admin-current-user') {
              return adminRole
                ? { data: { is_admin: true, role: adminRole, permissions: [] }, error: null }
                : { data: { is_admin: false, role: 'user', permissions: [] }, error: null }
            }
            return { data: null, error: null }
          },
        },
      }
    },
  })
}

describe('Release 6 operational panel', () => {
  it('blocks operational panel for common users', () => {
    visitOperational({ adminRole: null })
    cy.get('[data-testid="operational-blocked"]').should('contain.text', 'Acesso restrito')
  })

  it('shows operational events and exports sanitized diagnostics', () => {
    const events = [
      {
        id: 'event-1',
        source: 'ai_action',
        event_type: 'ai_action_confirmed',
        severity: 'info',
        status: 'success',
        function_name: 'confirm-action',
        metadata: { action_type: 'add_to_wishlist' },
        created_at: '2026-06-18T18:00:00.000Z',
      },
      {
        id: 'event-2',
        source: 'automation',
        event_type: 'automation_run_failed',
        severity: 'error',
        status: 'failed',
        function_name: 'run-automations',
        error_message: 'Falha sanitizada',
        metadata: {},
        created_at: '2026-06-18T18:05:00.000Z',
      },
    ]
    let exportedDiagnostics = null

    cy.intercept('POST', '**/functions/v1/operational-insights', (req) => {
      expect(req.body).not.to.have.keys(['user_id', 'userId', 'family_id', 'familyId'])
      if (req.body.action === 'summary') {
        req.reply({ body: { summary: { period_days: 7, totals: { events: 2, errors: 1, blocked: 0 }, by_severity: { info: 1, error: 1 }, by_source: { ai_action: 1, automation: 1 }, feature_flags: [], operation_limits: {} } } })
        return
      }
      if (req.body.action === 'recent_events') {
        const filtered = req.body.severity === 'error' ? events.filter((event) => event.severity === 'error') : events
        req.reply({ body: { events: filtered } })
        return
      }
      if (req.body.action === 'error_queue') {
        req.reply({ body: { events: events.filter((event) => event.status === 'failed') } })
        return
      }
      if (req.body.action === 'ai_actions_audit') {
        req.reply({ body: { ai_actions: [{ id: 'log-1', action_type: 'add_to_wishlist', reverted_at: null, created_at: '2026-06-18T18:00:00.000Z' }] } })
        return
      }
      if (req.body.action === 'automations_audit') {
        req.reply({ body: { automations: [], runs: [{ id: 'run-1', template_id: 'cash_balance_below', status: 'success', triggered: true }] } })
        return
      }
      if (req.body.action === 'export_diagnostics') {
        req.alias = 'exportDiagnostics'
        exportedDiagnostics = { generated_at: '2026-06-18T18:10:00.000Z', user_id_hash: 'abc123', period_days: 7, feature_flags: [], recent_errors: [], ai_actions_summary: {}, automations_summary: {}, financial_validation_summary: { transactions_included: false, complete_state_included: false }, environment: { release: '6' } }
        req.reply({ body: { diagnostics: exportedDiagnostics } })
        return
      }
      req.reply({ statusCode: 400, body: { error: { code: 'UNEXPECTED_ACTION', message: req.body.action } } })
    })

    cy.intercept('POST', '**/functions/v1/health-check', {
      body: { status: 'ok', release: '6', checks: { database: 'ok', feature_flags: 'ok', automations: 'ok', ai_actions: 'ok', observability: 'ok' }, timestamp: '2026-06-18T18:00:00.000Z' },
    })

    visitOperational()
    cy.get('[data-testid="operational-page"]').should('contain.text', 'não exibe senhas, tokens ou prompts completos')
    cy.get('[data-testid="operational-events"]').should('contain.text', 'ai_action_confirmed').and('contain.text', 'automation_run_failed')
    cy.get('[data-testid="operational-severity"]').select('Erro')
    cy.get('[data-testid="operational-events"]').should('contain.text', 'automation_run_failed')
    cy.get('[data-testid="diagnostics-export"]').click()
    cy.wait('@exportDiagnostics')
    cy.then(() => JSON.stringify(exportedDiagnostics, null, 2)).then((text) => {
      expect(text).to.include('"release": "6"')
      for (const forbidden of ['access_token', 'jwt', 'raw_prompt', 'full_finance_state', 'transactions":[{']) {
        expect(text).not.to.include(forbidden)
      }
    })
  })
})
