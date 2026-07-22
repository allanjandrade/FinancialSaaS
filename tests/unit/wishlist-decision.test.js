import { describe, expect, it } from 'vitest'
import {
  buildWishlistPurchaseSimulation,
  formatWishlistPrice,
  resolveWishlistRecommendation,
} from '@/utils/wishlist-decision.js'

function financeState() {
  return {
    settings: { year: 2026, selectedMonth: 6 },
    incomes: [{ id: 'i1', date: '2026-06-05', type: 'Salario', amount: 5000 }],
    expenses: [
      { id: 'e1', date: '2026-06-06', category: 'Mercado', payment: 'Pix', amount: 900 },
      { id: 'e2', date: '2026-06-08', category: 'Cartao', payment: 'Credito', amount: 500 },
    ],
    planningGoals: [],
    categoryBudgets: [],
  }
}

describe('wishlist decision helpers', () => {
  it('never formats missing wishlist prices as zero', () => {
    expect(formatWishlistPrice(null)).toBe('Cotação pendente')
    expect(formatWishlistPrice(0)).toBe('Cotação pendente')
    expect(formatWishlistPrice(undefined)).toBe('Cotação pendente')
    expect(formatWishlistPrice(199.9)).toBe('R$ 199,90')
  })

  it('returns a quote-pending decision instead of simulating without price', () => {
    const result = buildWishlistPurchaseSimulation({
      name: 'Monitor sem preco',
      value: null,
      priceStatus: 'pending_quote',
    }, financeState(), new Date('2026-06-19T12:00:00'))

    expect(result).toMatchObject({
      canSimulate: false,
      recommendation: 'esperar',
      status: 'quote_pending',
      priceLabel: 'Cotação pendente',
    })
    expect(result.would_write_transaction).toBe(false)
  })

  it('simulates purchase impact with real financial state when price exists', () => {
    const result = buildWishlistPurchaseSimulation({
      name: 'Cadeira ergonomica',
      value: 600,
      category: 'Outros',
      plannedPaymentMethod: 'credit',
      plannedInstallments: 3,
    }, financeState(), new Date('2026-06-19T12:00:00'))

    expect(result.canSimulate).toBe(true)
    expect(result.would_write_transaction).toBe(false)
    expect(result.monthly_impact).toBe(200)
    expect(['comprar', 'esperar', 'inviavel agora']).toContain(result.recommendation)
    expect(result.reasons.join(' ')).toContain('Saldo seguro')
  })

  it('does not let a zero ranking fallback hide a manually saved price', () => {
    const result = buildWishlistPurchaseSimulation({
      name: 'Mesa',
      value: 300,
      category: 'Outros',
    }, financeState(), new Date('2026-06-19T12:00:00'), { price: 0 })

    expect(result.canSimulate).toBe(true)
    expect(result.priceLabel).not.toBe('Cotação pendente')
    expect(result.amount).toBe(300)
  })

  it('maps deterministic simulation decisions to objective wishlist recommendations', () => {
    expect(resolveWishlistRecommendation('can_buy_now')).toBe('comprar')
    expect(resolveWishlistRecommendation('wait')).toBe('esperar')
    expect(resolveWishlistRecommendation('only_if_adjust_budget')).toBe('esperar')
    expect(resolveWishlistRecommendation('not_recommended')).toBe('inviavel agora')
    expect(resolveWishlistRecommendation('card_risk')).toBe('inviavel agora')
  })
})
