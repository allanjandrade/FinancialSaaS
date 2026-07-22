import { visitRelease10 } from './release10-helpers.js'

describe('Release 11.3 shared entries', () => {
  it('keeps regular entries private by default and exposes sharing copy', () => {
    visitRelease10('/entries')
    cy.get('[data-testid="entries-page"]').should('exist')
    cy.get('[data-testid="entry-sharing-section"]').should('contain.text', 'Privado por padrao')
  })

  it('keeps shared entries as dedicated records with participants', () => {
    cy.readFile('supabase/migrations/20260627130000_release113_family_sharing.sql')
      .should('contain', 'public.shared_entries')
      .and('contain', 'public.shared_entry_participants')
      .and('contain', 'unique (shared_entry_id, user_id)')
    cy.readFile('supabase/functions/shared-entry-create/index.ts')
      .should('contain', 'calculateParticipants')
      .and('not.contain', 'finance_states')
  })
})
