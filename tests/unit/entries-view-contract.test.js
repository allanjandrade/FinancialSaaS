import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import Entries from '@/views/Entries.vue'
import { useFinanceStore } from '@/stores/finance'
import { FINANCE_STORAGE_KEY, getUserScopedKey } from '@/lib/userScopedStorage'

const uploadMocks = vi.hoisted(() => ({
  uploadEntryAttachment: vi.fn(async () => ({ bucketMissing: false })),
}))

const documentOcrMocks = vi.hoisted(() => ({
  extractFinancialDocumentDraft: vi.fn(),
}))

vi.mock('@/composables/useEntryAttachmentUpload.js', () => ({
  useEntryAttachmentUpload: () => ({
    uploading: { value: false },
    validateFile: () => null,
    uploadEntryAttachment: uploadMocks.uploadEntryAttachment,
  }),
}))

vi.mock('@/utils/financial-document-ocr.js', async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...actual,
    extractFinancialDocumentDraft: documentOcrMocks.extractFinancialDocumentDraft,
  }
})

const TEST_USER_ID = 'entries-user'

function seedFinanceStore() {
  localStorage.setItem(getUserScopedKey(FINANCE_STORAGE_KEY, TEST_USER_ID), JSON.stringify({
    settings: { year: 2026, selectedMonth: 6, currentMemberId: 'member-1' },
    familyMembers: [{ id: 'member-1', name: 'Usuario', role: 'administrator' }],
    financialAccounts: [{ id: 'account-1', name: 'Santander', type: 'Conta Corrente', balance: 6670 }],
    incomes: [],
    expenses: [],
  }))
}

async function mountEntries(path = '/entries') {
  const pinia = createPinia()
  setActivePinia(pinia)
  const store = useFinanceStore()
  store.setActiveUser(TEST_USER_ID)
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/entries', component: Entries },
      { path: '/income-documents', component: { template: '<div />' } },
    ],
  })
  router.push(path)
  await router.isReady()
  return {
    wrapper: mount(Entries, {
      global: {
        plugins: [pinia, router],
        stubs: {
          ConfirmModal: true,
          EmptyState: { template: '<div class="empty-state" />' },
        },
      },
    }),
    store,
  }
}

describe('Entries view contract', () => {
  beforeEach(() => {
    uploadMocks.uploadEntryAttachment.mockClear()
    documentOcrMocks.extractFinancialDocumentDraft.mockReset()
  })

  it('selects an income type and preserves it in the history', async () => {
    seedFinanceStore()
    const { wrapper, store } = await mountEntries()

    await wrapper.get('.segment:nth-child(2)').trigger('click')
    const selects = wrapper.findAll('select')
    expect(selects[0].element.value).not.toBe('')

    const form = wrapper.get('form')
    const inputs = form.findAll('input')
    await inputs[1].setValue(3000)
    await form.find('input[placeholder="Opcional"]').setValue('Salario E2E')
    await form.trigger('submit')
    await wrapper.vm.$nextTick()

    expect(store.state.incomes[0]).toMatchObject({ type: 'Salário', description: 'Salario E2E', amount: 3000 })
    expect(wrapper.get('[data-testid="entries-history-list"]').text()).toContain('Salário')
    expect(wrapper.get('.badge.income').text()).toContain('Receita')
  })

  it('renders a saved expense with the correct record kind', async () => {
    seedFinanceStore()
    const { wrapper, store } = await mountEntries()

    store.addExpense({
      date: '2026-06-12',
      category: 'Moradia',
      description: 'Despesa E2E',
      payment: 'Pix',
      amount: 530,
      paid: true,
      sourceId: 'account-1',
      familyMemberId: 'member-1',
    })
    await wrapper.vm.$nextTick()

    expect(wrapper.get('.badge.expense').text()).toContain('Despesa')
    expect(wrapper.get('[data-testid="entries-history-list"]').text()).toContain('Moradia')
  })

  it('does not show an actionable source suggestion before there is a payable amount', async () => {
    seedFinanceStore()
    const { wrapper } = await mountEntries()

    await wrapper.get('summary.manual-entry-summary').trigger('click')
    await wrapper.vm.$nextTick()

    expect(wrapper.text()).not.toContain('Aplicar sugestão')
  })

  it('does not suggest VA as an action when the wallet has no available balance', async () => {
    localStorage.setItem(getUserScopedKey(FINANCE_STORAGE_KEY, TEST_USER_ID), JSON.stringify({
      settings: { year: 2026, selectedMonth: 6, currentMemberId: 'member-1' },
      familyMembers: [{ id: 'member-1', name: 'Usuario', role: 'administrator' }],
      financialAccounts: [{ id: 'account-1', name: 'Santander', type: 'Conta Corrente', balance: 6670 }],
      benefitWallets: [{ id: 'va-empty', name: 'VA - Vale Alimentação', kind: 'va', balance: 0 }],
      incomes: [],
      expenses: [],
    }))
    const { wrapper } = await mountEntries()

    await wrapper.get('summary.manual-entry-summary').trigger('click')
    const form = wrapper.get('form')
    const inputs = form.findAll('input')
    await inputs[1].setValue(80)
    await wrapper.vm.$nextTick()

    expect(wrapper.text()).toContain('Saldo bancário')
    expect(wrapper.text()).not.toContain('Mercado → use VA')
    expect(wrapper.text()).not.toContain('VA - Vale Alimentação (R$ 0,00 disponível)')
  })

  it('opens transfer mode from query and records internal transfer only', async () => {
    seedFinanceStore()
    localStorage.setItem(getUserScopedKey(FINANCE_STORAGE_KEY, TEST_USER_ID), JSON.stringify({
      settings: { year: 2026, selectedMonth: 6, currentMemberId: 'member-1' },
      familyMembers: [{ id: 'member-1', name: 'Usuario', role: 'administrator' }],
      financialAccounts: [
        { id: 'account-1', name: 'Santander', type: 'Conta Corrente', balance: 6670 },
        { id: 'account-2', name: 'Reserva', type: 'Poupança', balance: 1000 },
      ],
      incomes: [],
      expenses: [],
      internalTransfers: [],
    }))
    const { wrapper, store } = await mountEntries('/entries?transfer=1')

    expect(wrapper.get('.segment.active').text()).toContain('Transferência')
    expect(wrapper.get('[data-testid="transfer-form-fields"]').text()).toContain('Conta de origem')

    const form = wrapper.get('form')
    const inputs = form.findAll('input')
    await inputs[1].setValue(250)
    await form.find('input[placeholder="Opcional"]').setValue('Reserva mensal')
    await form.trigger('submit')
    await wrapper.vm.$nextTick()

    expect(store.state.internalTransfers).toHaveLength(1)
    expect(store.state.incomes).toHaveLength(0)
    expect(store.state.expenses).toHaveLength(0)
    expect(wrapper.get('[data-testid="entries-history-list"]').text()).toContain('Transferência')
  })

  it('saves income and expense entries with direct attachments', async () => {
    seedFinanceStore()
    const { wrapper, store } = await mountEntries()

    expect(wrapper.get('[data-testid="entry-ocr-primary-action"]').text()).toContain('Escanear documento')
    expect(wrapper.find('[data-testid="entry-review-panel"]').exists()).toBe(false)

    await wrapper.get('.segment:nth-child(2)').trigger('click')
    const incomeFile = new File(['holerite'], 'holerite.pdf', { type: 'application/pdf' })
    const incomeInput = wrapper.get('[data-testid="entry-attachment-input"]')
    Object.defineProperty(incomeInput.element, 'files', { value: [incomeFile], configurable: true })
    await incomeInput.trigger('change')

    let form = wrapper.get('form')
    let inputs = form.findAll('input')
    await inputs[1].setValue(4200)
    await form.find('input[placeholder="Opcional"]').setValue('Holerite Junho')
    await form.trigger('submit')
    await wrapper.vm.$nextTick()

    expect(store.state.incomes).toHaveLength(1)
    expect(uploadMocks.uploadEntryAttachment).toHaveBeenCalledWith(expect.objectContaining({
      file: incomeFile,
      entryKind: 'income',
      entryId: store.state.incomes[0].id,
      amount: 4200,
    }))

    await wrapper.get('.segment:nth-child(1)').trigger('click')
    const expenseFile = new File(['cupom'], 'mercado.jpg', { type: 'image/jpeg' })
    const expenseInput = wrapper.get('[data-testid="entry-attachment-input"]')
    Object.defineProperty(expenseInput.element, 'files', { value: [expenseFile], configurable: true })
    await expenseInput.trigger('change')

    form = wrapper.get('form')
    inputs = form.findAll('input')
    await inputs[1].setValue(180)
    await form.find('input[placeholder="Opcional"]').setValue('Mercado')
    await form.trigger('submit')
    await wrapper.vm.$nextTick()

    expect(store.state.expenses).toHaveLength(1)
    expect(uploadMocks.uploadEntryAttachment).toHaveBeenLastCalledWith(expect.objectContaining({
      file: expenseFile,
      entryKind: 'expense',
      entryId: store.state.expenses[0].id,
      amount: 180,
    }))
  })

  it('opens assisted OCR review for an uploaded receipt and only saves after confirmation', async () => {
    seedFinanceStore()
    const { wrapper, store } = await mountEntries()
    const receiptFile = new File(['cupom'], 'mercado.jpg', { type: 'image/jpeg' })
    documentOcrMocks.extractFinancialDocumentDraft.mockResolvedValue({
      mode: 'document',
      reviewState: 'review_pending',
      autoSave: false,
      file: receiptFile,
      fileName: 'mercado.jpg',
      type: 'expense',
      amount: 123.45,
      date: '2026-06-10',
      origin: 'Mercado Central',
      description: 'Mercado Central',
      category: 'Mercado',
      paymentMethod: 'Pix',
      sourceType: 'account',
      sourceId: 'account-1',
      confidence: 91,
      provider: 'Gemini',
      documentType: 'comprovante',
      pendingFields: [],
    })

    const input = wrapper.get('[data-testid="entry-attachment-input"]')
    Object.defineProperty(input.element, 'files', { value: [receiptFile], configurable: true })
    await input.trigger('change')
    await new Promise((resolve) => setTimeout(resolve, 0))
    await wrapper.vm.$nextTick()

    expect(documentOcrMocks.extractFinancialDocumentDraft).toHaveBeenCalledWith(receiptFile)
    expect(store.state.expenses).toHaveLength(0)
    expect(wrapper.get('[data-testid="document-review-origin"]').element.value).toBe('Mercado Central')
    expect(wrapper.get('[data-testid="document-review-section"]').text()).toContain('91%')

    await wrapper.get('[data-testid="document-review-confirm"]').trigger('click')
    await wrapper.vm.$nextTick()
    await wrapper.get('form').trigger('submit')
    await wrapper.vm.$nextTick()

    expect(store.state.expenses).toHaveLength(1)
    expect(store.state.expenses[0]).toMatchObject({
      amount: 123.45,
      category: 'Mercado',
      description: 'Mercado Central',
      ocrProvider: 'Gemini',
      ocrConfidence: 91,
      ocrTipoDocumento: 'comprovante',
    })
    expect(uploadMocks.uploadEntryAttachment).toHaveBeenCalledWith(expect.objectContaining({
      file: receiptFile,
      entryKind: 'expense',
      entryId: store.state.expenses[0].id,
      amount: 123.45,
    }))
  })

  it('saves OCR card documents as open credit-card expenses after review', async () => {
    localStorage.setItem(getUserScopedKey(FINANCE_STORAGE_KEY, TEST_USER_ID), JSON.stringify({
      settings: { year: 2026, selectedMonth: 6, currentMemberId: 'member-1' },
      familyMembers: [{ id: 'member-1', name: 'Usuario', role: 'administrator' }],
      financialAccounts: [{ id: 'account-1', name: 'Santander', type: 'Conta Corrente', balance: 6670 }],
      creditCards: [{ id: 'card-1', name: 'Visa', limit: 5000, closingDay: 20, dueDay: 8 }],
      incomes: [],
      expenses: [],
    }))
    const { wrapper, store } = await mountEntries()
    const receiptFile = new File(['cupom'], 'cartao.pdf', { type: 'application/pdf' })
    documentOcrMocks.extractFinancialDocumentDraft.mockResolvedValue({
      mode: 'document',
      reviewState: 'review_pending',
      autoSave: false,
      file: receiptFile,
      fileName: 'cartao.pdf',
      type: 'card',
      amount: 240,
      date: '2026-06-18',
      origin: 'Mercado Cartao',
      description: 'Mercado Cartao',
      category: 'Mercado',
      paymentMethod: 'Credito',
      sourceType: 'credit_card',
      sourceId: 'card-1',
      confidence: 86,
      provider: 'Gemini',
      documentType: 'fatura',
      pendingFields: [],
    })

    const input = wrapper.get('[data-testid="entry-attachment-input"]')
    Object.defineProperty(input.element, 'files', { value: [receiptFile], configurable: true })
    await input.trigger('change')
    await new Promise((resolve) => setTimeout(resolve, 0))
    await wrapper.vm.$nextTick()

    await wrapper.get('[data-testid="document-review-confirm"]').trigger('click')
    await wrapper.vm.$nextTick()
    await wrapper.get('form').trigger('submit')
    await wrapper.vm.$nextTick()

    expect(store.state.expenses).toHaveLength(1)
    expect(store.state.expenses[0]).toMatchObject({
      amount: 240,
      payment: 'Crédito',
      sourceType: 'credit_card',
      sourceId: 'card-1',
      creditCardId: 'card-1',
      paid: false,
    })
  })

  it('saves OCR transfer documents as internal transfers and uploads the attachment as transfer', async () => {
    localStorage.setItem(getUserScopedKey(FINANCE_STORAGE_KEY, TEST_USER_ID), JSON.stringify({
      settings: { year: 2026, selectedMonth: 6, currentMemberId: 'member-1' },
      familyMembers: [{ id: 'member-1', name: 'Usuario', role: 'administrator' }],
      financialAccounts: [
        { id: 'account-1', name: 'Conta', type: 'Conta Corrente', balance: 1000 },
        { id: 'account-2', name: 'Reserva', type: 'Poupanca', balance: 0 },
      ],
      incomes: [],
      expenses: [],
      internalTransfers: [],
    }))
    const { wrapper, store } = await mountEntries()
    const transferFile = new File(['comprovante'], 'transferencia.pdf', { type: 'application/pdf' })
    documentOcrMocks.extractFinancialDocumentDraft.mockResolvedValue({
      mode: 'document',
      reviewState: 'review_pending',
      autoSave: false,
      file: transferFile,
      fileName: 'transferencia.pdf',
      type: 'transfer',
      amount: 300,
      date: '2026-06-20',
      origin: 'Transferencia interna',
      description: 'Reserva mensal',
      category: 'Outros',
      paymentMethod: 'Transferencia',
      sourceType: 'account',
      sourceId: 'account-1',
      confidence: 82,
      provider: 'deterministic_pdf',
      documentType: 'extrato',
      pendingFields: [],
    })

    const input = wrapper.get('[data-testid="entry-attachment-input"]')
    Object.defineProperty(input.element, 'files', { value: [transferFile], configurable: true })
    await input.trigger('change')
    await new Promise((resolve) => setTimeout(resolve, 0))
    await wrapper.vm.$nextTick()

    await wrapper.get('[data-testid="document-review-confirm"]').trigger('click')
    await wrapper.vm.$nextTick()
    await wrapper.get('form').trigger('submit')
    await wrapper.vm.$nextTick()

    expect(store.state.internalTransfers).toHaveLength(1)
    expect(store.state.expenses).toHaveLength(0)
    expect(store.state.incomes).toHaveLength(0)
    expect(uploadMocks.uploadEntryAttachment).toHaveBeenCalledWith(expect.objectContaining({
      file: transferFile,
      entryKind: 'transfer',
      entryId: store.state.internalTransfers[0].id,
      amount: 300,
    }))
  })

  it('shows manual OCR fallback review and does not save a failed extraction automatically', async () => {
    seedFinanceStore()
    const { wrapper, store } = await mountEntries()
    const receiptFile = new File(['ruim'], 'borrado.png', { type: 'image/png' })
    documentOcrMocks.extractFinancialDocumentDraft.mockResolvedValue({
      mode: 'document',
      reviewState: 'review_pending',
      autoSave: false,
      manualFallback: true,
      file: receiptFile,
      fileName: 'borrado.png',
      type: 'expense',
      amount: null,
      date: '2026-06-10',
      origin: '',
      description: '',
      category: '',
      paymentMethod: '',
      confidence: 0,
      provider: 'Manual',
      documentType: 'Preenchimento manual',
      friendlyError: 'Não foi possível ler o documento. Revise e preencha os campos pendentes antes de salvar.',
      pendingFields: ['amount', 'origin', 'category', 'paymentMethod'],
    })

    const input = wrapper.get('[data-testid="entry-attachment-input"]')
    Object.defineProperty(input.element, 'files', { value: [receiptFile], configurable: true })
    await input.trigger('change')
    await new Promise((resolve) => setTimeout(resolve, 0))
    await wrapper.vm.$nextTick()

    expect(store.state.expenses).toHaveLength(0)
    expect(wrapper.get('[data-testid="document-review-section"]').text()).toContain('Não foi possível ler o documento')
    expect(wrapper.get('[data-testid="document-review-section"]').text()).toContain('Campos pendentes')
  })

  it('imports reviewed bank statement rows from a CSV file', async () => {
    seedFinanceStore()
    const { wrapper, store } = await mountEntries()

    expect(wrapper.get('[data-testid="statement-import-section"]').text()).toContain('Importar extrato')

    const statementFile = new File([
      'Data;Descricao;Valor\n01/06/2026;PIX MERCADO;-123,45\n02/06/2026;SALARIO ACME;3500,00',
    ], 'extrato.csv', { type: 'text/csv' })
    const statementInput = wrapper.get('[data-testid="statement-import-input"]')
    Object.defineProperty(statementInput.element, 'files', { value: [statementFile], configurable: true })
    await statementInput.trigger('change')
    await new Promise((resolve) => setTimeout(resolve, 0))
    await wrapper.vm.$nextTick()

    expect(wrapper.get('[data-testid="statement-import-preview"]').text()).toContain('PIX MERCADO')
    expect(wrapper.get('[data-testid="statement-import-preview"]').text()).toContain('SALARIO ACME')
    expect(wrapper.get('[data-testid="statement-import-summary"]').text()).toContain('2 para criar')

    await wrapper.get('[data-testid="statement-import-confirm"]').trigger('click')
    await wrapper.vm.$nextTick()

    expect(store.state.expenses).toHaveLength(1)
    expect(store.state.incomes).toHaveLength(1)
    expect(store.state.expenses[0]).toMatchObject({
      date: '2026-06-01',
      description: 'PIX MERCADO',
      category: 'Mercado',
      amount: 123.45,
    })
    expect(store.state.incomes[0]).toMatchObject({
      date: '2026-06-02',
      description: 'SALARIO ACME',
      amount: 3500,
    })
    expect(store.state.importSessions).toHaveLength(1)
  })

  it('shows duplicate and subscription reconciliation status before importing a statement', async () => {
    localStorage.setItem(getUserScopedKey(FINANCE_STORAGE_KEY, TEST_USER_ID), JSON.stringify({
      settings: { year: 2026, selectedMonth: 7, currentMemberId: 'member-1' },
      familyMembers: [{ id: 'member-1', name: 'Usuario', role: 'administrator' }],
      financialAccounts: [{ id: 'account-1', name: 'Santander', type: 'Conta Corrente', balance: 6670 }],
      incomes: [],
      expenses: [
        {
          id: 'expense-existing',
          date: '2026-07-03',
          description: 'PIX MERCADO CENTRAL',
          amount: 123.45,
          category: 'Mercado',
          payment: 'Pix',
        },
      ],
      subscriptions: [
        {
          id: 'sub-netflix',
          name: 'Netflix',
          provider: 'Netflix',
          category: 'Streaming',
          amount: 30,
          billing_cycle: 'monthly',
          next_billing_date: '2026-08-09',
          status: 'active',
          payment_method_type: 'account',
          account_id: 'account-1',
        },
      ],
      subscriptionCharges: [],
      importSessions: [],
    }))
    const { wrapper, store } = await mountEntries()

    const statementFile = new File([
      'Data;Descricao;Valor\n03/07/2026;PIX MERCADO CENTRAL;-123,45\n09/08/2026;NETFLIX.COM;-30,00',
    ], 'extrato.csv', { type: 'text/csv' })
    const statementInput = wrapper.get('[data-testid="statement-import-input"]')
    Object.defineProperty(statementInput.element, 'files', { value: [statementFile], configurable: true })
    await statementInput.trigger('change')
    await new Promise((resolve) => setTimeout(resolve, 0))
    await wrapper.vm.$nextTick()

    const previewText = wrapper.get('[data-testid="statement-import-preview"]').text()
    expect(previewText).toContain('Duplicado')
    expect(previewText).toContain('Conciliar assinatura')
    expect(wrapper.get('[data-testid="statement-import-summary"]').text()).toContain('1 conciliado')

    await wrapper.get('[data-testid="statement-import-confirm"]').trigger('click')
    await wrapper.vm.$nextTick()

    expect(store.state.expenses).toHaveLength(2)
    expect(store.state.expenses.find((expense) => expense.description === 'NETFLIX.COM')).toMatchObject({
      subscriptionId: 'sub-netflix',
    })
  })
})
