import { describe, expect, it } from 'vitest'
import {
  buildStatementImportPreview,
  detectStatementDuplicate,
  suggestEntryClassification,
} from '@/domain/reconciliation/reconciliationEngine.js'

describe('statement reconciliation engine', () => {
  it('classifies statement rows before creating financial entries', () => {
    const state = {
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
      incomes: [],
      subscriptions: [
        {
          id: 'sub-netflix',
          name: 'Netflix',
          provider: 'Netflix',
          category: 'Streaming',
          amount: 30,
          billing_cycle: 'monthly',
          billing_interval: 1,
          next_billing_date: '2026-08-09',
          status: 'active',
          payment_method_type: 'card',
          card_id: 'card-1',
        },
      ],
      subscriptionCharges: [],
    }

    const preview = buildStatementImportPreview(state, [
      { id: 'row-1', kind: 'expense', date: '2026-07-03', description: 'PIX MERCADO CENTRAL', amount: 123.45 },
      { id: 'row-2', kind: 'expense', date: '2026-07-05', description: 'POSTO IPIRANGA', amount: 220 },
      { id: 'row-3', kind: 'expense', date: '2026-08-09', description: 'NETFLIX.COM', amount: 30 },
      { id: 'row-4', kind: 'income', date: '2026-07-01', description: 'SALARIO ACME', amount: 5000 },
    ], {
      sourceType: 'credit_card',
      sourceId: 'card-1',
      payment: 'Credito',
      referenceDate: '2026-07-13',
    })

    expect(preview.summary).toMatchObject({
      totalRows: 4,
      createCount: 2,
      duplicateCount: 1,
      reconcileCount: 1,
    })
    expect(preview.items.find((item) => item.id === 'row-1')).toMatchObject({
      action: 'duplicate',
      duplicateOf: { kind: 'expense', id: 'expense-existing' },
    })
    expect(preview.items.find((item) => item.id === 'row-2')).toMatchObject({
      action: 'create',
      suggestedCategory: 'Combustível',
    })
    expect(preview.items.find((item) => item.id === 'row-3')).toMatchObject({
      action: 'reconcile',
      subscriptionId: 'sub-netflix',
      suggestedCategory: 'Assinaturas',
    })
    expect(preview.items.find((item) => item.id === 'row-4')).toMatchObject({
      action: 'create',
      suggestedType: 'Salário',
    })
  })

  it('detects duplicates inside the imported file itself', () => {
    const preview = buildStatementImportPreview({}, [
      { id: 'salary-a', kind: 'income', date: '2026-07-01', description: 'SALARIO ACME', amount: 5000 },
      { id: 'salary-b', kind: 'income', date: '2026-07-01', description: 'SALARIO ACME', amount: 5000 },
    ])

    expect(preview.items[0].action).toBe('create')
    expect(preview.items[1]).toMatchObject({
      action: 'duplicate',
      duplicateOf: { kind: 'import_row', id: 'salary-a' },
    })
    expect(preview.summary.duplicateCount).toBe(1)
  })

  it('exposes small pure helpers for classification and duplicate checks', () => {
    expect(suggestEntryClassification({
      kind: 'expense',
      description: 'DROGARIA SAUDE',
    })).toMatchObject({ category: 'Farmácia' })

    expect(detectStatementDuplicate(
      { kind: 'expense', date: '2026-07-03', description: 'Mercado Central', amount: 123.45 },
      [{ id: 'expense-1', kind: 'expense', date: '2026-07-03', description: 'PIX MERCADO CENTRAL', amount: 123.45 }],
    )).toMatchObject({ id: 'expense-1' })
  })
})
