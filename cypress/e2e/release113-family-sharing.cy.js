import { visitRelease10 } from './release10-helpers.js'

describe('Release 11.3 family sharing', () => {
  it('shows the shared family management entry point and keeps local members', () => {
    visitRelease10('/family')
    cy.get('[data-testid="family-page"]').should('exist')
    cy.get('[data-testid="family-sharing-page"]').should('contain.text', 'Escopo financeiro')
    cy.get('[data-testid="family-create-group"]').should('contain.text', 'Criar familia compartilhada')
    cy.get('[data-testid="family-member-form"]').should('contain.text', 'Nome')
  })

  it('has invite route, invite page and edge functions wired', () => {
    cy.readFile('src/router/index.js').should('contain', "path: '/family/invite/:token'")
    cy.readFile('src/views/FamilyInvite.vue').should('contain', 'acceptFamilyInvite')
    cy.readFile('src/views/Family.vue').should('contain', 'data-testid="family-pending-invites"')
    cy.readFile('supabase/functions/family-send-invite/index.ts').should('contain', 'family_invite_sent')
    cy.readFile('supabase/functions/family-accept-invite/index.ts').should('contain', 'findInviteByTokenOrId')
    cy.readFile('supabase/functions/_shared/family-sharing.ts').should('contain', 'sha256Hex(token)')
  })
})
