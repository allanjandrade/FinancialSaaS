import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useFinanceStore } from '@/stores/finance.js'
import { FINANCE_STORAGE_KEY, getUserScopedKey } from '@/lib/userScopedStorage.js'
import { SOURCE_TYPES } from '@/constants/financial-structure.js'
import { buildSubscriptionMonthImpact } from '@/utils/subscriptions.js'

const schedulePush = vi.fn()

vi.mock('@/stores/family-sync.js', () => ({
  useFamilySyncStore: () => ({
    applyingRemote: false,
    schedulePush,
  }),
}))

describe('useFinanceStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    localStorage.clear()
    schedulePush.mockClear()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('persiste estado no localStorage ao salvar', () => {
    const store = useFinanceStore()
    store.setActiveUser('test-user')
    store.state.settings.familyName = 'Familia QA'
    store.saveState({ skipCloudPush: true })

    const saved = JSON.parse(localStorage.getItem(getUserScopedKey(FINANCE_STORAGE_KEY, 'test-user')))
    expect(saved.settings.familyName).toBe('Familia QA')
    expect(schedulePush).not.toHaveBeenCalled()
  })

  it('agenda push na nuvem quando nao skipCloudPush', async () => {
    const store = useFinanceStore()
    store.setActiveUser('test-user')
    store.saveState()
    await new Promise((resolve) => queueMicrotask(resolve))
    await vi.waitFor(() => expect(schedulePush).toHaveBeenCalled(), { timeout: 500 })
  })

  it('calcMonth agrega receitas do mes', () => {
    const store = useFinanceStore()
    store.state.settings.year = 2026
    store.state.incomes = [
      { id: 'i1', date: '2026-06-01', amount: 3000, type: 'Salario' },
      { id: 'i2', date: '2026-05-01', amount: 999, type: 'Salario' },
    ]
    const june = store.calcMonth(6)
    expect(june.incomeCash).toBe(3000)
  })

  it('usa o mês atual como período padrão ao carregar dados salvos antigos', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-09T12:00:00.000Z'))

    const userId = 'month-default-user'
    localStorage.setItem(getUserScopedKey(FINANCE_STORAGE_KEY, userId), JSON.stringify({
      settings: {
        year: 2026,
        selectedMonth: 6,
        familyName: 'Família QA',
      },
      incomes: [],
      expenses: [],
    }))

    const store = useFinanceStore()
    store.setActiveUser(userId)

    expect(store.state.settings.year).toBe(2026)
    expect(store.state.settings.selectedMonth).toBe(7)
    expect(store.selectedKey).toBe(202607)

  })

  it('registra historico de preco sem sobrescrever e gera alerta por alvo', () => {
    const store = useFinanceStore()

    store.recordManualPrice({
      product: { name: 'Cafe 500g', category: 'Mercado', default_unit: 'un' },
      storeName: 'Mercado A',
      price: 22,
      target_price: 20,
      collected_at: '2026-06-01T12:00:00Z',
    })
    store.recordManualPrice({
      product: { name: 'Cafe 500g', category: 'Mercado', default_unit: 'un' },
      storeName: 'Mercado A',
      price: 18,
      target_price: 20,
      collected_at: '2026-06-02T12:00:00Z',
    })

    expect(store.state.products).toHaveLength(1)
    expect(store.state.priceRecords).toHaveLength(2)
    expect(store.state.priceAlerts).toHaveLength(1)
    expect(store.state.priceAlerts[0].target_price).toBe(20)

    const stats = store.resolveProductPriceStats(store.state.products[0].id)
    expect(stats.current_price).toBe(18)
  })

  it('salva as tres menores ofertas com links no historico da wishlist', () => {
    const store = useFinanceStore()
    store.setActiveUser('test-user')
    const item = store.addWishlistItem({ name: 'Lanterna Punto' })

    store.addPriceSnapshot(item.id, {
      price: 240.48,
      total: 240.48,
      marketplace: 'Jocar',
      source: 'live',
      offers: [
        { marketplace: 'Loja D', total: 310, url: 'https://example.com/d' },
        { marketplace: 'Jocar', total: 240.48, url: 'https://example.com/jocar' },
        { marketplace: 'Loja B', total: 255, url: 'https://example.com/b' },
        { marketplace: 'Loja C', total: 270, url: 'https://example.com/c' },
      ],
    })

    expect(store.state.wishlist[0].priceHistory[0].offers).toEqual([
      expect.objectContaining({ marketplace: 'Jocar', total: 240.48, url: 'https://example.com/jocar' }),
      expect.objectContaining({ marketplace: 'Loja B', total: 255, url: 'https://example.com/b' }),
      expect.objectContaining({ marketplace: 'Loja C', total: 270, url: 'https://example.com/c' }),
    ])
  })

  it('sanitiza URLs externas da wishlist antes de persistir ou renderizar', () => {
    const store = useFinanceStore()
    store.setActiveUser('test-user')

    const item = store.addWishlistItem({
      name: 'Produto seguro',
      imageUrl: 'data:image/svg+xml,<svg onload=alert(1)>',
      originalUrl: 'javascript:alert(1)',
      originalLink: 'javascript:alert(2)',
      canonicalUrl: 'https://loja.example/produto',
    })

    expect(item.imageUrl).toBe('')
    expect(item.originalUrl).toBe('')
    expect(item.originalLink).toBe('')
    expect(item.canonicalUrl).toBe('https://loja.example/produto')

    store.addPriceSnapshot(item.id, {
      price: 99,
      total: 99,
      marketplace: 'Loja',
      url: 'javascript:alert(3)',
      offers: [
        { marketplace: 'Loja', total: 99, url: 'javascript:alert(4)', link: 'https://loja.example/oferta' },
      ],
    })

    expect(store.state.wishlist[0].priceHistory[0].url).toBe('')
    expect(store.state.wishlist[0].priceHistory[0].offers[0].url).toBe('https://loja.example/oferta')
  })

  it('importa cupom revisado como despesa e historico de precos', () => {
    const store = useFinanceStore()
    const result = store.importMarketReceipt({
      receiptKey: '12345678901234567890123456789012345678901234',
      establishmentName: 'Mercado Teste',
      cnpj: '12345678000190',
      purchaseDate: '2026-06-02',
      total: 42.4,
      paymentMethod: 'Pix',
      items: [
        { name: 'Cafe 500g', quantity: 1, unit: 'un', unitPrice: 18.9, totalPrice: 18.9, barcode: '7891' },
        { name: 'Arroz 5kg', quantity: 1, unit: 'un', unitPrice: 23.5, totalPrice: 23.5, barcode: '7892' },
      ],
    })

    expect(result.ok).toBe(true)
    expect(store.state.expenses).toHaveLength(1)
    expect(store.state.expenses[0]).toMatchObject({
      category: 'Mercado',
      amount: 42.4,
      payment: 'Pix',
    })
    expect(store.state.products).toHaveLength(2)
    expect(store.state.priceRecords).toHaveLength(2)
    expect(store.state.priceRecords.every((record) => record.source === 'receipt_import')).toBe(true)

    const duplicate = store.importMarketReceipt({
      receiptKey: '12345678901234567890123456789012345678901234',
      establishmentName: 'Mercado Teste',
      cnpj: '12345678000190',
      purchaseDate: '2026-06-02',
      total: 42.4,
      paymentMethod: 'Pix',
      items: [
        { name: 'Cafe 500g', quantity: 1, unit: 'un', unitPrice: 18.9, totalPrice: 18.9 },
      ],
    })
    expect(duplicate).toMatchObject({ ok: false, reason: 'duplicate' })
  })

  it('vincula documentos a receitas e despesas', () => {
    const store = useFinanceStore()
    store.setActiveUser('test-user')
    store.state.familyMembers = [{ id: 'member-1', name: 'Usuario' }]
    store.state.financialAccounts = [{ id: 'account-1', name: 'Conta', type: 'Conta Corrente', balance: 0 }]

    const income = store.addIncome({
      date: '2026-06-01',
      type: 'Salario',
      amount: 4000,
      sourceId: 'account-1',
    })
    const expense = store.addExpense({
      date: '2026-06-02',
      category: 'Mercado',
      payment: 'Pix',
      amount: 120,
      sourceId: 'account-1',
    })

    const incomeDoc = store.addEntryDocument({
      id: 'doc-income',
      entryKind: 'income',
      entryId: income.id,
      fileName: 'holerite.pdf',
    })
    const expenseDoc = store.addEntryDocument({
      id: 'doc-expense',
      entryKind: 'expense',
      entryId: expense.id,
      fileName: 'cupom.jpg',
    })

    expect(store.linkEntryDocumentToEntry(incomeDoc.id, 'income', income.id)).toBe(true)
    expect(store.linkEntryDocumentToEntry(expenseDoc.id, 'expense', expense.id)).toBe(true)
    expect(store.state.incomes[0].documentIds).toEqual(['doc-income'])
    expect(store.state.expenses[0].documentIds).toEqual(['doc-expense'])
    expect(store.getEntryDocuments('expense', expense.id)[0].fileName).toBe('cupom.jpg')
  })

  it('vincula documentos a transferencias internas sem criar receita ou despesa', () => {
    const store = useFinanceStore()
    store.setActiveUser('test-user')
    store.state.familyMembers = [{ id: 'member-1', name: 'Usuario' }]
    store.state.financialAccounts = [
      { id: 'account-1', name: 'Conta', type: 'Conta Corrente', balance: 1000 },
      { id: 'account-2', name: 'Reserva', type: 'Conta Poupanca', balance: 0 },
    ]

    const transfer = store.addInternalTransfer({
      date: '2026-06-20',
      amount: 300,
      fromType: SOURCE_TYPES.ACCOUNT,
      fromId: 'account-1',
      toType: SOURCE_TYPES.ACCOUNT,
      toId: 'account-2',
      description: 'Reserva mensal',
    })
    const doc = store.addEntryDocument({
      id: 'doc-transfer',
      entryKind: 'transfer',
      entryId: transfer.id,
      fileName: 'transferencia.pdf',
    })

    expect(store.linkEntryDocumentToEntry(doc.id, 'transfer', transfer.id)).toBe(true)
    expect(store.state.internalTransfers[0].documentIds).toEqual(['doc-transfer'])
    expect(store.getEntryDocuments('transfer', transfer.id)[0].fileName).toBe('transferencia.pdf')
    expect(store.state.incomes).toHaveLength(0)
    expect(store.state.expenses).toHaveLength(0)
  })

  it('confirma importacao de extrato com preview, conciliacao e rollback', () => {
    const store = useFinanceStore()
    store.setActiveUser('statement-user')
    store.state.familyMembers = [{ id: 'member-1', name: 'Usuario' }]
    store.state.creditCards = [{ id: 'card-1', name: 'Visa', limit: 1000, availableLimit: 1000, closingDay: 20 }]
    store.state.expenses = [
      {
        id: 'expense-existing',
        date: '2026-07-03',
        description: 'PIX MERCADO CENTRAL',
        amount: 123.45,
        category: 'Mercado',
        payment: 'Pix',
      },
    ]
    store.addSubscription({
      id: 'sub-netflix',
      name: 'Netflix',
      provider: 'Netflix',
      category: 'Streaming',
      amount: 30,
      billing_cycle: 'monthly',
      next_billing_date: '2026-08-09',
      status: 'active',
      payment_method_type: 'card',
      card_id: 'card-1',
    })

    const preview = store.buildStatementImportPreview([
      { id: 'row-duplicate', kind: 'expense', date: '2026-07-03', description: 'PIX MERCADO CENTRAL', amount: 123.45 },
      { id: 'row-netflix', kind: 'expense', date: '2026-08-09', description: 'NETFLIX.COM', amount: 30 },
      { id: 'row-salary', kind: 'income', date: '2026-07-01', description: 'SALARIO ACME', amount: 5000 },
    ], {
      sourceType: SOURCE_TYPES.CREDIT_CARD,
      sourceId: 'card-1',
      payment: 'Credito',
      familyMemberId: 'member-1',
    })

    expect(preview.summary).toMatchObject({ createCount: 1, duplicateCount: 1, reconcileCount: 1 })

    const session = store.confirmStatementImportPreview(preview)

    expect(session).toMatchObject({
      status: 'confirmed',
      sourceType: SOURCE_TYPES.CREDIT_CARD,
      createdEntries: [
        expect.objectContaining({ kind: 'expense' }),
        expect.objectContaining({ kind: 'income' }),
      ],
    })
    expect(store.state.importSessions).toHaveLength(1)
    expect(store.state.expenses).toHaveLength(2)
    expect(store.state.incomes).toHaveLength(1)
    expect(store.state.expenses.find((expense) => expense.description === 'NETFLIX.COM')).toMatchObject({
      subscriptionId: 'sub-netflix',
      subscriptionChargeId: expect.any(String),
    })
    expect(store.state.subscriptionCharges).toHaveLength(1)

    const augustImpact = buildSubscriptionMonthImpact(store.state, { year: 2026, month: 8 })
    expect(augustImpact.forecastTotal).toBe(0)
    expect(augustImpact.actualLinkedTotal).toBe(30)

    expect(store.rollbackImportSession(session.id)).toBe(true)
    expect(store.state.importSessions[0].status).toBe('rolled_back')
    expect(store.state.expenses).toHaveLength(1)
    expect(store.state.incomes).toHaveLength(0)
    expect(store.state.subscriptionCharges).toHaveLength(0)
  })
})
