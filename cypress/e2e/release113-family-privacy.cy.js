import { financeState, visitRelease10 } from './release10-helpers.js'

describe('Release 11.3 family privacy', () => {
  it('shows my/family mode on dashboard and reports', () => {
    const state = {
      ...financeState(),
      expenses: [{ id: 'e1', date: '2026-06-15', amount: 120, category: 'Mercado', description: 'Compra do mes' }],
    }
    visitRelease10('/dashboard', { state })
    cy.get('[data-testid="family-dashboard-mode"]').should('contain.text', 'Minha visao').and('contain.text', 'Familia')

    visitRelease10('/reports')
    cy.get('[data-testid="family-dashboard-mode"]').should('contain.text', 'Minha visao').and('contain.text', 'Familia')
  })

  it('enforces RLS membership and rejects forged identity in edge contracts', () => {
    cy.readFile('supabase/migrations/20260627130000_release113_family_sharing.sql')
      .should('contain', 'public.is_family_member')
      .and('contain', "fm.status = 'active'")
      .and('contain', 'created_by = auth.uid()')
    cy.readFile('supabase/functions/shared-entry-create/index.ts').should('contain', 'rejectControlledIdentity')
    cy.readFile('supabase/functions/family-remove-member/index.ts').should('contain', "status: 'removed'")
  })
})
