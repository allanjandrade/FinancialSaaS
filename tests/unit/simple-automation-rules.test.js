import { describe, expect, it } from 'vitest'
import {
  analysisPeriodLabel,
  buildSpendingAlert,
  findCategoryKeywordSuggestions,
  suggestCategoryByKeyword,
} from '@/utils/simple-automation-rules.js'

describe('simple automation rules', () => {
  it('suggests categories from common keywords without AI', () => {
    expect(suggestCategoryByKeyword('Compra no supermercado Extra')).toMatchObject({
      category: 'Mercado',
      keyword: 'supermercado',
    })

    expect(suggestCategoryByKeyword('Netflix plano mensal')).toMatchObject({
      category: 'Assinaturas',
      keyword: 'netflix',
    })
  })

  it('builds spending alerts for the selected analysis period', () => {
    const state = {
      expenses: [
        { id: 'recent', date: '2026-07-08', description: 'Mercado', amount: 400, payment: 'Pix' },
        { id: 'older', date: '2026-07-01', description: 'Restaurante', amount: 200, payment: 'Pix' },
        { id: 'previous-month', date: '2026-06-20', description: 'Compra antiga', amount: 900, payment: 'Pix' },
        { id: 'transfer', date: '2026-07-08', description: 'Transferência', amount: 3000, isInternalTransfer: true },
      ],
    }

    const lastSevenDays = buildSpendingAlert(state, {
      referenceDate: '2026-07-09',
      periodDays: 7,
      threshold: 300,
    })

    expect(lastSevenDays).toMatchObject({
      periodLabel: 'últimos 7 dias',
      spent: 400,
      threshold: 300,
      triggered: true,
      expenseCount: 1,
    })

    const lastThirtyDays = buildSpendingAlert(state, {
      referenceDate: '2026-07-09',
      periodDays: 30,
      threshold: 2000,
    })

    expect(lastThirtyDays).toMatchObject({
      periodLabel: 'últimos 30 dias',
      spent: 1500,
      triggered: false,
      expenseCount: 3,
    })
  })

  it('finds uncategorized entries that can receive keyword suggestions', () => {
    const state = {
      expenses: [
        { id: 'a', date: '2026-07-08', description: 'Uber viagem', category: 'Outros', amount: 32 },
        { id: 'b', date: '2026-07-08', description: 'Padaria sem regra', category: 'Outros', amount: 12 },
      ],
    }

    expect(findCategoryKeywordSuggestions(state)).toEqual([
      expect.objectContaining({ id: 'a', category: 'Transporte', keyword: 'uber' }),
    ])
  })

  it('labels analysis periods clearly', () => {
    expect(analysisPeriodLabel(15)).toBe('últimos 15 dias')
    expect(analysisPeriodLabel('month')).toBe('mês atual')
  })
})
