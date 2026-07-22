import { describe, expect, it } from 'vitest'
import {
  buildPriceStats,
  percentageVariation,
  recommendationFromVariation,
  RECOMMENDATION_STATES,
} from '@/utils/price-monitoring.js'

describe('price-monitoring', () => {
  it('calcula variacao percentual contra a media', () => {
    expect(percentageVariation(118, 100)).toBe(18)
    expect(percentageVariation(88, 100)).toBe(-12)
    expect(percentageVariation(0, 100)).toBeNull()
  })

  it('classifica recomendacao por faixa de variacao', () => {
    expect(recommendationFromVariation(-12)).toBe(RECOMMENDATION_STATES.BUY)
    expect(recommendationFromVariation(0)).toBe(RECOMMENDATION_STATES.NORMAL)
    expect(recommendationFromVariation(12)).toBe(RECOMMENDATION_STATES.WAIT)
    expect(recommendationFromVariation(22)).toBe(RECOMMENDATION_STATES.HIGH_ALERT)
  })

  it('gera resumo historico por produto', () => {
    const product = { id: 'p1', name: 'Cafe 500g' }
    const now = new Date('2026-06-02T12:00:00Z')
    const records = [
      { product_id: 'p1', price: 118, collected_at: '2026-06-02T12:00:00Z' },
      { product_id: 'p1', price: 100, collected_at: '2026-05-20T12:00:00Z' },
      { product_id: 'p1', price: 100, collected_at: '2026-04-10T12:00:00Z' },
      { product_id: 'p2', price: 5, collected_at: '2026-06-02T12:00:00Z' },
    ]

    const stats = buildPriceStats(product, records, { usual_quantity: 2, purchase_frequency_days: 30 }, now)

    expect(stats.current_price).toBe(118)
    expect(stats.average_price_90_days).toBeCloseTo(106)
    expect(stats.lowest_price_90_days).toBe(100)
    expect(stats.variation_percentual).toBeCloseTo(11.32, 2)
    expect(stats.recommendation).toBe(RECOMMENDATION_STATES.WAIT)
    expect(stats.estimated_monthly_spend).toBeCloseTo(212)
  })
})
