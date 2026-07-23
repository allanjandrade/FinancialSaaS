import { visitRelease10 } from './release10-helpers.js'

const entriesState = {
  settings: { year: 2026, selectedMonth: 6, currentMemberId: 'member-1' },
  familyMembers: [{ id: 'member-1', name: 'Release 11.2', role: 'administrator' }],
  financialAccounts: [
    { id: 'account-1', name: 'Conta', type: 'Conta Corrente', balance: 1000 },
    { id: 'account-2', name: 'Reserva', type: 'Poupanca', balance: 500 },
  ],
  creditCards: [],
  benefitWallets: [],
  incomes: [],
  expenses: [],
  internalTransfers: [],
  wishlist: [],
}

function selectImageStatement() {
  cy.get('[data-testid="statement-import-input"]').selectFile({
    contents: Cypress.Buffer.from('not-an-image'),
    fileName: 'extrato.png',
    mimeType: 'image/png',
    lastModified: Date.now(),
  }, { force: true })
}

function selectEntryAttachment(fileName = 'comprovante.png') {
  cy.get('[data-testid="entry-attachment-input"]').selectFile({
    contents: Cypress.Buffer.from('not-an-image'),
    fileName,
    mimeType: 'image/png',
    lastModified: Date.now(),
  }, { force: true })
}

describe('Release 11.2 entries actions', () => {
  it('opens transfer mode from query without creating income or expense', () => {
    visitRelease10('/entries?transfer=1', { state: entriesState })
    cy.get('[data-testid="entries-page"]').should('exist')
    cy.contains(/Transfer/i).should('exist')
    cy.get('[data-testid="transfer-form-fields"]').should('exist')
    cy.location('search').should('not.contain', 'transfer=1')
    cy.contains('Importar').should('exist')
    cy.contains(/Novo lancamento|Novo lan/i).should('not.exist')
  })

  it('shows an actionable message when statement OCR is unavailable', () => {
    cy.intercept('POST', '**/functions/v1/statement-ocr', { forceNetworkError: true }).as('statementOcrFail')

    visitRelease10('/entries', { state: entriesState })
    cy.get('[data-testid="entries-page"]').should('exist')
    selectImageStatement()

    cy.wait('@statementOcrFail')
    cy.contains('OCR online indisponivel. Tente novamente ou use CSV/PDF com texto selecionavel.').should('be.visible')
    cy.get('[data-testid="statement-import-preview"]').should('not.exist')
    cy.get('[data-testid="entries-page"]').should('be.visible')
  })

  it('imports remote OCR statement rows only after review confirmation', () => {
    cy.intercept('POST', '**/functions/v1/statement-ocr', {
      statusCode: 200,
      body: {
        rows: [
          { date: '2026-06-07', description: 'PIX FARMACIA', amount: 72.45, kind: 'expense' },
          { date: '2026-06-08', description: 'PIX RECEBIDO CLIENTE', amount: 180, kind: 'income' },
        ],
      },
    }).as('statementOcrSuccess')

    visitRelease10('/entries', { state: entriesState })
    cy.get('[data-testid="entries-page"]').should('exist')
    selectImageStatement()

    cy.wait('@statementOcrSuccess')
    cy.get('[data-testid="statement-import-preview"]').should('be.visible')
    cy.contains('PIX FARMACIA').should('be.visible')
    cy.contains('PIX RECEBIDO CLIENTE').should('be.visible')
    cy.get('.history-panel').should('not.contain.text', 'PIX FARMACIA')

    cy.get('[data-testid="statement-import-confirm"]').click()
    cy.contains('PIX FARMACIA').should('be.visible')
    cy.contains('PIX RECEBIDO CLIENTE').should('be.visible')
    cy.get('[data-testid="statement-import-preview"]').should('not.exist')
  })

  it('keeps receipt OCR in assisted review and links the attachment after saving', () => {
    cy.intercept('POST', '**/functions/v1/receipt-ocr', {
      statusCode: 200,
      body: {
        tipoDocumento: 'comprovante',
        estabelecimento: 'Mercado Central',
        valor: 94.35,
        data: '2026-06-11',
        categoria: 'Mercado',
        metodo: 'Pix',
        confianca: 91,
      },
    }).as('receiptOcrSuccess')

    visitRelease10('/entries', { state: entriesState })
    cy.get('[data-testid="entries-page"]').should('exist')
    selectEntryAttachment()

    cy.wait('@receiptOcrSuccess')
    cy.get('[data-testid="document-review-section"]').should('be.visible')
    cy.get('[data-testid="document-review-origin"]').should('have.value', 'Mercado Central')
    cy.get('[data-testid="document-review-amount"]').should('have.value', '94.35')
    cy.get('.history-panel').should('not.contain.text', 'Mercado Central')

    cy.get('[data-testid="document-review-confirm"]').click()
    cy.contains('button', /Salvar/i).click()

    cy.contains('Mercado Central').should('be.visible')
    cy.contains('[data-testid="entries-history-list"] .entry-record', 'Mercado Central').within(() => {
      cy.get('.attachment-badge').should('contain.text', '1')
    })
  })

  it('opens manual assisted review when receipt OCR fails', () => {
    cy.intercept('POST', '**/functions/v1/receipt-ocr', { forceNetworkError: true }).as('receiptOcrFail')

    visitRelease10('/entries', { state: entriesState })
    cy.get('[data-testid="entries-page"]').should('exist')
    selectEntryAttachment('comprovante-falha.png')

    cy.wait('@receiptOcrFail')
    cy.get('[data-testid="document-review-section"]').should('be.visible')
    cy.contains('Nao foi possivel ler o documento').should('be.visible')
    cy.contains('Campos pendentes').should('be.visible')
    cy.get('.history-panel').should('not.contain.text', 'Comprovante manual')

    cy.get('[data-testid="document-review-amount"]').clear().type('31.9')
    cy.get('[data-testid="document-review-origin"]').clear().type('Comprovante manual')
    cy.get('[data-testid="document-review-payment"]').select('Pix')
    cy.get('[data-testid="document-review-confirm"]').click()
    cy.contains('button', /Salvar/i).click()

    cy.contains('Comprovante manual').should('be.visible')
    cy.contains('[data-testid="entries-history-list"] .entry-record', 'Comprovante manual').within(() => {
      cy.get('.attachment-badge').should('contain.text', '1')
    })
  })

  it('saves payroll OCR as income after assisted review', () => {
    cy.intercept('POST', '**/functions/v1/receipt-ocr', {
      statusCode: 200,
      body: {
        tipoDocumento: 'holerite',
        tipo: 'receita',
        estabelecimento: 'Empresa ACME',
        valor: 4200,
        data: '2026-06-05',
        categoria: 'Salario',
        metodo: 'Transferencia',
        confianca: 88,
      },
    }).as('payrollOcrSuccess')

    visitRelease10('/entries', { state: entriesState })
    cy.get('[data-testid="entries-page"]').should('exist')
    selectEntryAttachment('holerite.png')

    cy.wait('@payrollOcrSuccess')
    cy.get('[data-testid="document-review-section"]').should('be.visible')
    cy.get('[data-testid="document-review-type"]').should('have.value', 'income')
    cy.get('[data-testid="document-review-origin"]').should('have.value', 'Empresa ACME')
    cy.get('.history-panel').should('not.contain.text', 'Empresa ACME')

    cy.get('[data-testid="document-review-confirm"]').click()
    cy.contains('button', /Salvar/i).click()

    cy.contains('Empresa ACME').should('be.visible')
    cy.contains('[data-testid="entries-history-list"] .entry-record', 'Empresa ACME').within(() => {
      cy.contains('Receita').should('be.visible')
      cy.get('.attachment-badge').should('contain.text', '1')
    })
  })
})
