function installAuthStub(win) {
  const calls = { reset: [], update: [] }
  win.__authCalls = calls
  win.SUPABASE_CONFIG = { url: 'https://example.supabase.co', anonKey: 'e2e-anon' }
  win.supabase = {
    auth: {
      getSession: async () => ({ data: { session: null }, error: null }),
      getUser: async () => ({ data: { user: null }, error: null }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
      resetPasswordForEmail: async (email, options) => {
        calls.reset.push({ email, options })
        return { data: {}, error: null }
      },
      updateUser: async (payload) => {
        calls.update.push(payload)
        return { data: {}, error: null }
      },
    },
  }
}

describe('Release 11 password reset flow', () => {
  it('shows forgot-password entry point and sends a neutral reset request', () => {
    cy.visit('/login', { onBeforeLoad: installAuthStub })
    cy.contains('a', 'Esqueci minha senha').should('have.attr', 'href', '/forgot-password')

    cy.visit('/forgot-password', { onBeforeLoad: installAuthStub })
    cy.get('input[type="email"]').type('user@example.com')
    cy.get('input[type="email"]').should('have.value', 'user@example.com')
    cy.contains('button', /Enviar link/).click()

    cy.contains('Se esse e-mail estiver cadastrado').should('exist')
    cy.contains(/nao cadastrado|não cadastrado|not found/i).should('not.exist')
    cy.window().then((win) => {
      expect(win.__authCalls.reset).to.have.length(1)
      expect(win.__authCalls.reset[0].email).to.eq('user@example.com')
      expect(win.__authCalls.reset[0].options.redirectTo).to.match(/\/reset-password$/)
    })
  })

  it('updates password only after the strong password policy passes', () => {
    cy.visit('/reset-password', { onBeforeLoad: installAuthStub })
    cy.get('input[type="password"]').eq(0).type('123456')
    cy.get('input[type="password"]').eq(1).type('123456')
    cy.contains('button', 'Salvar nova senha').click()
    cy.contains('12 caracteres').should('exist')
    cy.window().then((win) => {
      expect(win.__authCalls.update).to.have.length(0)
    })

    cy.get('input[type="password"]').eq(0).clear().type('StrongPass!123')
    cy.get('input[type="password"]').eq(1).clear().type('StrongPass!123')
    cy.contains('button', 'Salvar nova senha').click()
    cy.contains('Senha atualizada com sucesso').should('exist')
    cy.window().then((win) => {
      expect(win.__authCalls.update).to.deep.eq([{ password: 'StrongPass!123' }])
    })
  })
})
