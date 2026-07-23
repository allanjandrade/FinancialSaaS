import { financeState, visitRelease10 } from './release10-helpers.js'

describe('Release 11 transfer route', () => {
  it('opens transfer form from query and records internal transfer only', () => {
    const state = {
      ...financeState(),
      financialAccounts: [
        { id: 'account-1', name: 'Conta principal', type: 'Conta Corrente', balance: 5000 },
        { id: 'account-2', name: 'Reserva', type: 'Poupança', balance: 1000 },
      ],
      incomes: [],
      expenses: [],
      internalTransfers: [],
    }

    visitRelease10('/entries?transfer=1', { state })
    cy.get('[data-testid="entry-mode-copy"]').should('contain.text', 'Nova transferência')
    cy.get('[data-testid="transfer-form-fields"]').should('contain.text', 'Conta de origem').and('contain.text', 'Conta de destino')
    cy.get('input[type="number"]').first().clear().type('250')
    cy.get('input[placeholder="Opcional"]').clear().type('Reserva mensal')
    cy.contains('button', 'Salvar transferência').click()
    cy.get('[data-testid="entries-history-list"]').should('contain.text', 'Transferência')
    cy.window().then((win) => {
      const raw = win.localStorage.getItem('controle-financeiro-app-v2:10101010-1010-4010-9010-101010101010')
      const saved = JSON.parse(raw)
      expect(saved.internalTransfers).to.have.length(1)
      expect(saved.incomes).to.have.length(0)
      expect(saved.expenses).to.have.length(0)
    })
  })
})
