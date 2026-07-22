import { visitRelease10 } from './release10-helpers.js'

describe('Release 10 admin and testers', () => {
  it('hides Admin for common users and testers', () => {
    visitRelease10('/dashboard', { staleAdminCache: true })
    cy.get('[data-testid="app-sidebar"]').should('not.contain.text', 'Admin')

    visitRelease10('/dashboard')
    cy.get('[data-testid="app-sidebar"]').should('not.contain.text', 'Admin')

    visitRelease10('/dashboard', { tester: true, subscription: { status: 'free', plan_code: 'free' } })
    cy.get('[data-testid="app-sidebar"]').should('not.contain.text', 'Admin')
  })

  it('admin opens /admin, invites tester and sees audit', () => {
    visitRelease10('/admin', { admin: 'admin' })

    cy.get('[data-testid="admin-page"]').should('contain.text', 'Admin')
    cy.get('[data-testid="admin-tabs"]').should('contain.text', 'Testers')
    cy.contains('button', 'Testers').click()
    cy.get('[data-testid="tester-email"]').clear().type('tester@example.com')
    cy.get('[data-testid="invite-tester"]').click()
    cy.get('[data-testid="admin-testers"]').should('contain.text', 'Convite criado')
    cy.contains('button', 'Auditoria').click()
    cy.get('[data-testid="admin-audit"]').should('contain.text', 'admin_invited_tester')
  })

  it('keeps mobile admin layout without horizontal overflow', () => {
    visitRelease10('/admin', { admin: 'support' })
    cy.viewport(390, 844)
    cy.window().then((win) => {
      expect(win.document.documentElement.scrollWidth).to.be.lte(win.innerWidth + 1)
    })
  })

  it('shows Operational only to owner and admin, not support', () => {
    visitRelease10('/dashboard', { admin: 'support' })
    cy.get('[data-testid="app-sidebar"]').should('contain.text', 'Admin')
    cy.get('[data-testid="app-sidebar"]').should('not.contain.text', 'Operacional')

    visitRelease10('/dashboard', { admin: 'owner' })
    cy.get('[data-testid="app-sidebar"]').should('contain.text', 'Admin')
    cy.get('[data-testid="app-sidebar"]').should('contain.text', 'Operacional')
  })
})
